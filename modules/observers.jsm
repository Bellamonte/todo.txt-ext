/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/Timer.jsm");

Components.utils.import("resource://todotxt/util.jsm");
Components.utils.import("resource://todotxt/logger.jsm");
Components.utils.import("resource://todotxt/fileUtil.jsm");
Components.utils.import("resource://todotxt/todoclient.jsm");

EXPORTED_SYMBOLS = ['timerObserver','prefObserver'];

/*
 * Observer for notices of timers for synchronization process
 */
var timerObserver = {

  calendar: null,
  checkSum: null,

  register: function(cal) {
    this.calendar = cal;

    // Add periodical verification of todo files, every 30s
    timer = Components.classes["@mozilla.org/timer;1"]
      .createInstance(Components.interfaces.nsITimer);
    timer.init(this, 30*1000, Components.interfaces.nsITimer.TYPE_REPEATING_SLACK);

    todotxtLogger.debug('timerObserver','register');
  },

  unregister: function() {
    this.calendar = null;
    if(this.timer) timer.cancel();

    todotxtLogger.debug('timerObserver','unregister');
  },

  // Verify if todo & done file changed by
  // comparing MD5 checksum, if different refresh calendar
  observe: function(aSubject, aTopic, aData) {
    try{
      let old_checksum = this.checkSum;
      this.checkSum = this.calculateMD5();

      // Verify if not first run, old_checksum != undef
      if(old_checksum){
        if(old_checksum != this.checkSum){
          todotxtLogger.debug('timerObserver','refresh');
          this.calendar.refresh();
        }
      }
    } catch(e){
      todotxtLogger.error('timerObserver:observe',e);
    }
  },

  notify: function(timer){
    todotxtLogger.debug('timerObserver','notify');
    this.checkSum = this.calculateMD5();
  },

  updateMD5: function(){
    let timer = Components.classes["@mozilla.org/timer;1"]
      .createInstance(Components.interfaces.nsITimer);
    timer.initWithCallback(timerObserver, 1*1000, Components.interfaces.nsITimer.TYPE_ONE_SHOT);
  },

  calculateMD5: function(){
    let data_array = [];
    let result = "";
    let prefs = util.getPreferences();

    // Use MD5, hash for comparison and needs to be fast not secure
    let ch = Components.classes["@mozilla.org/security/hash;1"].
                         createInstance(Components.interfaces.nsICryptoHash);
    let converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].
                        createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    converter.charset = "UTF-8";

    ch.init(ch.MD5);

    todoFile = fileUtil.getTodoFile(true);
    doneFile = fileUtil.getDoneFile(true);

    if (todoFile)
      data_array.push(fileUtil.readFile(todoFile);
    if (doneFile)
      data_array.push(fileUtil.readFile(doneFile);

    Promise.all(data_array).then(function (result) {
      let parseBlob = "";

      for (i = 0; i < result.length; i++) {
        parseBlob += result[i];

      let converterResult = {};
      let data = converter.convertToByteArray(parseBlob, converterResult);
      ch.update(data, data.length);

      result = ch.finish(true);
      todotxtLogger.debug('timerObserver:calculateMD5','hash ['+result+']');
      return result
    }, function (aError) {
      throw exception.UNKNOWN();
    });
  }
};

/* 
 * Observer for changing properties
 */
var prefObserver = {
  
  calendar: null,

  register: function(cal) {
    this.calendar = cal;

    // For this.branch we ask for the preferences for extensions.myextension. and children
    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                      .getService(Components.interfaces.nsIPrefService);
    this.branch = prefs.getBranch("extensions.todotxt.");

    if (!("addObserver" in this.branch))
        this.branch.QueryInterface(Components.interfaces.nsIPrefBranch2);

    // Finally add the observer.
    this.branch.addObserver("", this, false);
  },

  unregister: function() {
    this.calendar = null;
    this.branch.removeObserver("", this);
    todotxtLogger.debug('prefObserver:unregister');
  },

  observe: function(aSubject, aTopic, aData) {
    switch (aData) {
      case "creation":
      case "thunderbird":
      case "showFullTitle":
        this.calendar.refresh();
        break;
      case "done-txt":
      case "todo-txt":
        todoClient.setTodo();
        this.calendar.refresh();
        break;
    }
    
    // Reset notifications so that new errors
    // can be displayed
    todotxtLogger.resetNotifications();
  }
};
