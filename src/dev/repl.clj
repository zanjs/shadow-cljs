(ns repl
  (:require [shadow.cljs.devtools.embedded :as cljs]
            [shadow.cljs.devtools.server :as server]))

(defn start []
  ;; (cljs/start! {:verbose true})
  ;; (cljs/start-worker :ui)
  (server/start!)
  ;; (cljs/start-worker :cli)
  ::started)

(defn stop []
  ;; (cljs/stop!)
  (server/stop!)
  ::stopped)

(defn repl []
  (cljs/repl :script))

;; (ns-tools/set-refresh-dirs "src/main")

(defn go []
  (stop)
  ;; this somehow breaks reloading
  ;; the usual :reloading message tells me that is namespace is being reloaded
  ;; but when the new instance is launched it is still using the old one
  ;; i cannot figure out why
  ;; (ns-tools/refresh :after 'repl/start)
  (start))