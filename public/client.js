/* global hterm, lib */
;(function () {
  'use strict'
  var WSURL = 'ws://' + window.location.host
  var terminal
  var timer
  var isDirty = false
  var reconnects = 0
  var maxReconnects = 300

  function Command (ws, args) {
    this.args = args
    this.ws = ws
  }

  Command.prototype.run = function () {
    this.args.io.onVTKeystroke = function (str) {
      // ignore
    }
    this.args.io.sendString = function (str) {
      // ignore
    }
    this.args.io.onTerminalResize = function (col, row) {
      // ignore
    }
  }

  function createWS () {
    var ws = new window.WebSocket(WSURL)

    ws.onopen = function () {
      console.log('ws open')
      terminal.wipeContents()
      terminal.runCommandClass(Command.bind({}, ws))
      isDirty = true
    }

    ws.onmessage = function (event) {
      terminal.io.writeUTF16(event.data)
    }

    ws.onclose = function (event) {
      if (isDirty) {
        terminal.wipeContents()
        isDirty = false
      }

      if (reconnects++ > maxReconnects) {
        terminal.wipeContents()
        terminal.io.writelnUTF16('Connection failed. Giving up!')
        return
      }

      terminal.io.writeUTF16('.')

      // the onclose evt might be fired multiple times
      clearTimeout(timer)
      timer = setTimeout(function () {
        createWS()
      }, 1000)
    }

    ws.onerror = function (err) {
      // FIXME
    }
  }

  lib.init(function () {
    hterm.defaultStorage = new lib.Storage.Memory()
    terminal = new hterm.Terminal()
    terminal.decorate(document.getElementById('terminal'))
    terminal.onTerminalReady = function () {
      console.info('terminal ready')
      terminal.prefs_.set('font-size', 12)
      terminal.prefs_.set('cursor-blink', true)
      terminal.prefs_.set('cursor-blink-cycle', [500, 500])
      terminal.prefs_.set('scroll-on-output', true)
      terminal.setCursorPosition(0, 0)
      terminal.setCursorVisible(true)
      createWS()
    }
  })
})()

