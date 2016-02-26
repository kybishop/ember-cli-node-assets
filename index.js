/* jshint node: true */
'use strict';

var path = require('path');
var resolve = require('resolve');
var clone = require('clone');
var debug = require('debug')('ember-cli-node-assets');

var Funnel = require('broccoli-funnel');
var UnwatchedTree = require('broccoli-unwatched-tree');
var MergeTrees = require('broccoli-merge-trees');

module.exports = {
  name: 'ember-cli-node-assets',

  included: function(parent) {
    this._super.included.apply(this, arguments);
    this.doImports();
  },

  doImports: function() {
    var app = this.app || this.parent.app;
    if (!app || !app.import) { return; }

    this.getOptions().modules.forEach(function(mod) {
      if (!mod.import) return;
      mod.import.include.forEach(function(file) {
        var fullPath = path.join('vendor', mod.import.destDir, file);
        debug('importing %s', fullPath);
        app.import(fullPath);
      });
    });
  },

  treeForVendor: function() {
    return treeFor('import', this.getOptions(), this.parent);
  },

  treeForPublic: function() {
    return treeFor('public', this.getOptions(), this.parent);
  },

  getOptions: function() {
    if (!this._options) {
      var options = this.app ? this.app.options : this.parent.options;
      this._options = normalizeOptions(this.parent, options && options.nodeAssets);
    }
    return this._options;
  }
};

function normalizeOptions(parent, options) {
  if (!options) { return { modules: [] }; }

  var modules = Object.keys(options).map(function(name) {
    var moduleOptions = clone(options[name]);
    if (typeof moduleOptions === 'function') {
      moduleOptions = moduleOptions.call(parent);
    }

    if ('enabled' in moduleOptions && !moduleOptions.enabled) { return; }

    return {
      name: name,
      import: normalizeFunnelOptions(moduleOptions, 'import', name),
      public: normalizeFunnelOptions(moduleOptions, 'public', 'assets')
    };
  });

  return { modules: modules.filter(Boolean) };
}

function normalizeFunnelOptions(options, key, defaultDestDir) {
  var normalized = options[key];
  if (!normalized) { return; }

  if (Array.isArray(normalized)) {
    normalized = { include: normalized };
  }

  if (options.srcDir && !normalized.srcDir) {
    normalized.srcDir = options.srcDir;
  }

  normalized.destDir = normalized.destDir || defaultDestDir;

  return normalized;
}

function treeFor(type, options, parent) {
  var trees = collectModuleTrees(type, options.modules, parent);
  if (trees.length === 1) {
    return trees[0];
  } else if (trees.length > 1) {
    return new MergeTrees(trees, { annotation: 'ember-cli-node-assets (' + type + ')' });
  }
}

function collectModuleTrees(type, modules, parent) {
  return modules.filter(function(mod) {
    return mod[type];
  }).map(function(mod) {
    var tree = npmTree(mod.name, parent, mod[type]);
    if (mod[type].processTree) {
      tree = mod[type].processTree.call(parent, tree);
    }
    return tree;
  });
}

function npmTree(name, parent, options) {
  var root = path.dirname(resolve.sync(name + '/package.json', { basedir: parent.root }));
  debug('adding tree for %s at %s %o', name, root, options);
  return new Funnel(new UnwatchedTree(root), options);
}
