
var SHADOW_IMPORT_PATH = "/Users/zilence/code/shadow-devtools/target/shadow-node/demo.warnings/cljs-runtime";
var SHADOW_ENV = {};
try {require('source-map-support').install();} catch (e) {console.warn('no "source-map-support" (run "npm install source-map-support --save-dev" to get it)');}

SHADOW_ENV.CLOSURE_NO_DEPS = true;

SHADOW_ENV.CLOSURE_DEFINES = {"goog.DEBUG":true,"goog.LOCALE":"en"};

var SHADOW_ROOTS = ["goog"];

var goog = SHADOW_ENV.goog = {};

SHADOW_ENV.SHADOW_IMPORTED = {};

var PATH = require("path");
var VM = require("vm");
var FS = require("fs");

// extract [root] for all goog.provide('[root].something');
// we need to pull them into local scope for every eval
var SHADOW_EXTRACT_ROOTS = function(js) {
  var re = /goog.provide\(([^)]+)\);/g
  var match = null;
  while (match = re.exec(js)) {
    var provide = match[1];
    var end = provide.indexOf('.');
    if (end == -1) {
      end = provide.length - 1;
    }

    // skip first char as match will be "cljs.core" or 'cljs.core' but always with quotes
    // end at either the first dot or end of provide-1 for one-segement namespaces
    var root = provide.substring(1, end);

    if (!SHADOW_ROOTS.includes(root)) {
      SHADOW_ENV[root] = {};
      SHADOW_ROOTS.push(root);
    }
  }
};

var SHADOW_PROVIDE = function(name) {
  return goog.exportPath_(name, undefined, SHADOW_ENV);
};

var SHADOW_REQUIRE = function(name) {
  return true;
};

var SHADOW_WRAP = function(js) {
  var code = "(function (require, module, __filename, __dirname, SHADOW_ENV) {\n";
  // this is part of goog/base.js and for some reason the only global var not on goog or goog.global
  code += "var COMPILED = false;\n"

  SHADOW_ROOTS.forEach(function(root) {
    code += "var " + root + "=SHADOW_ENV." + root + ";\n";
  });

  code += js;

  code += "\n});";
  return code;
};

var SHADOW_WRAP_OFFSET = function() {
  // -1 because we have one more lines than original (the wrapper above)
  return (2 + SHADOW_ROOTS.length) * -1;
};

var SHADOW_IMPORT = SHADOW_ENV.SHADOW_IMPORT = function(src) {
  if (SHADOW_ENV.CLOSURE_DEFINES["shadow.debug"]) {
    console.info("SHADOW load:", src);
  }

  SHADOW_ENV.SHADOW_IMPORTED[src] = true;

  // NODE_INCLUDE_PATH points to an absolute path, injected by shadow/cljs/node.clj
  var filePath = SHADOW_IMPORT_PATH + '/' + src;

  var js = FS.readFileSync(filePath);

  SHADOW_EXTRACT_ROOTS(js);
  var code = SHADOW_WRAP(js);

  var fn = VM.runInThisContext(code,
    {filename: filePath,
     lineOffset: SHADOW_WRAP_OFFSET(),
     displayErrors: true
     });

  // the comment is for source-map-support which unfortunately shows the wrong piece of code but the stack is correct
  try {
  /* ignore this, look at stacktrace */ fn.call(SHADOW_ENV, require, module, __filename, __dirname, SHADOW_ENV);
  } catch (e) {
    console.error("SHADOW import error", filePath);
    throw e;
  }

  return true;
};

SHADOW_ENV.NODE_EVAL = function(js, smJson) {
  var prefix = "return (";
  var code = SHADOW_WRAP(prefix + js + ");");
  if (smJson) {
    code += "\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,";
    code += new Buffer(smJson).toString('base64');
  }

  // console.log(code);

  var fn = VM.runInThisContext(code,
    {filename: "<eval>",
     lineOffset: SHADOW_WRAP_OFFSET(),
     columnOffset: prefix.length,
     displayErrors: true
     });
  return fn.call(SHADOW_ENV, require, module, __filename, __dirname, SHADOW_ENV);
};

SHADOW_IMPORT("goog/base.js");
goog.provide = SHADOW_PROVIDE;
goog.require = SHADOW_REQUIRE;
SHADOW_IMPORT("goog/reflect/reflect.js");
SHADOW_IMPORT("goog/math/long.js");
SHADOW_IMPORT("goog/math/integer.js");
SHADOW_IMPORT("goog/string/string.js");
SHADOW_IMPORT("goog/object/object.js");
SHADOW_IMPORT("goog/debug/error.js");
SHADOW_IMPORT("goog/dom/nodetype.js");
SHADOW_IMPORT("goog/asserts/asserts.js");
SHADOW_IMPORT("goog/array/array.js");
SHADOW_IMPORT("goog/string/stringbuffer.js");
SHADOW_IMPORT("cljs/core.js");
SHADOW_IMPORT("shadow/runtime_setup.js");
SHADOW_IMPORT("demo/warnings.js");
SHADOW_IMPORT("shadow/module/append/script.js");
var shadow = SHADOW_ENV.shadow || {};
var cljs = SHADOW_ENV.cljs || {};
var demo = SHADOW_ENV.demo;
