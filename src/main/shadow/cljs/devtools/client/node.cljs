(ns shadow.cljs.devtools.client.node
  (:require [shadow.cljs.devtools.client.env :as env]
            [cljs.reader :as reader]
            [goog.object :as gobj]))

(def WS (js/require "ws"))

(defonce client-id (random-uuid))

(defonce ws-ref (volatile! nil))

(defn ws-close []
  (when-some [tcp @ws-ref]
    (.close tcp)
    (vreset! ws-ref nil)))

(defn ws-msg [msg]
  (when-some [ws @ws-ref]
    (.send ws (pr-str msg)
      (fn [err]
        (when err
          (js/console.error "REPL msg send failed" err))))
    ))

(defn repl-error [result e]
  (js/console.error "eval error" e)
  result)

(defn node-eval [{:keys [js source-map-json] :as msg}]
  (let [result (js/SHADOW_ENV.NODE_EVAL js source-map-json)]
    result))

(defn is-loaded? [src]
  (true? (gobj/get js/SHADOW_ENV.SHADOW_IMPORTED src)))

(defn closure-import [src]
  (js/SHADOW_ENV.SHADOW_IMPORT src))

(defn repl-init
  [{:keys [id repl-state] :as msg}]
  (let [{:keys [repl-js-sources]}
        repl-state]

    (doseq [js repl-js-sources
            :when (not (is-loaded? js))]
      (closure-import js))

    (ws-msg {:type :repl/init-complete :id id})
    ))

(defn repl-invoke [{:keys [id] :as msg}]
  (let [result
        (-> (env/repl-call #(node-eval msg) pr-str repl-error)
            (assoc :id id))]

    (ws-msg result)))

(defn repl-set-ns [{:keys [id] :as msg}]
  ;; nothing for the client to do really
  (ws-msg {:type :repl/set-ns-complete :id id}))

(defn repl-require
  [{:keys [id js-sources reload] :as msg}]
  (try
    (doseq [src js-sources
            :when (or reload
                      (not (is-loaded? src)))]
      (closure-import src))
    (ws-msg {:type :repl/require-complete :id id})

    (catch :default e
      (js/console.error "repl/require failed" e)
      (ws-msg {:type :repl/require-error :id id})
      )))

(defn build-complete
  [{:keys [info] :as msg}]

  (when env/autoload
    (let [{:keys [sources compiled]}
          info

          files-to-require
          (->> sources
               (filter (fn [{:keys [name]}]
                         (contains? compiled name)))
               (map :js-name)
               (into []))]

      (when (seq files-to-require)

        (let [reload-state (volatile! nil)]

          (when env/before-load
            (let [fn (js/goog.getObjectByName env/before-load)]
              (js/console.warn "REPL before-load" env/before-load)
              (vreset! reload-state (fn))))

          (doseq [src files-to-require]
            (closure-import src))

          (when env/after-load
            (let [fn (js/goog.getObjectByName env/after-load)]
              (js/console.warn "REPL after-load " env/after-load)
              (if-not env/reload-with-state
                (fn)
                (fn @reload-state))))))
      )))

(defn process-message
  [{:keys [type] :as msg}]
  ;; (prn [:repl-msg type msg])
  (case type
    :repl/init
    (repl-init msg)

    :repl/invoke
    (repl-invoke msg)

    :repl/set-ns
    (repl-set-ns msg)

    :repl/require
    (repl-require msg)

    :build-start
    :ignored

    :build-complete
    (build-complete msg)

    ;; default
    (prn [:repl-unknown msg])
    ))

(defn ws-connect []
  (let [url
        (env/ws-url :node)

        client
        (WS. url "foo")]

    (.on client "open"
      (fn []
        (vreset! ws-ref client)))

    (.on client "unexpected-response"
      (fn [req res]
        (let [status (.-statusCode res)]
          (if (= 406 status)
            (js/console.log "REPL connection rejected, probably stale JS connecting to new server.")
            (js/console.log "REPL unexpected error" (.-statusCode res))
            ))))

    (.on client "message"
      (fn [data flags]
        (try
          (-> data
              (reader/read-string)
              (process-message))

          (catch :default e
            (js/console.error "failed to process message" data e)))))

    (.on client "close"
      (fn []
        (js/console.log "REPL client disconnected")
        ))

    (.on client "error"
      (fn [err]
        (js/console.log "REPL client error" err)))
    ))

(when env/enabled
  (ws-close) ;; if this is reloaded, reconnect the socket
  (ws-connect))

