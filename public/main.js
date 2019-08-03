const vscode = acquireVsCodeApi()

async function call (param) {
  return await vscode.postMessage(param)
}

const app = new Vue({
  el: '#app',
  data: {
    activeTag: 'info',
    info: {},
    table: null,
    json: '',
    detail: 'det',
  },
  methods: {
    runAsQuery: async function () {
      call({
        command: 'runAsQuery',
      })
    },

    displayResult: function (result) {
      this.activeTag = 'table'
      this.info = result.info
      this.table = result.table
      this.json = result.json
      this.detail = result.detail
    },

    displayValue: function (value) {
      if (value === null) {
        return 'NULL'
      } else {
        return value
      }
    }
  }
});

window.addEventListener('message', event => {
  const message = event.data;

  switch (message.command) {
    case 'runAsQuery':
      app.displayResult(message.result)
  }
});

