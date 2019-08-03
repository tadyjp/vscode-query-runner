const vscode = acquireVsCodeApi ();

async function call (param) {
  return await vscode.postMessage (param);
}

const vueApp = new Vue ({
  el: '#app',
  data: {
    activeTag: 'info',
    queryStatus: 'none',
    info: null,
    table: null,
    json: '',
    detail: 'det',
    errorMessage: null,
  },
  computed: {
    elapsedTime () {
      if (!this.info || !this.info.startTime || !this.info.endTime) {
        return;
      }

      return (parseInt(this.info.endTime) - parseInt(this.info.startTime)) / 1000
    },
    totalBytesProcessed () {
      if (!this.info || !this.info.totalBytesProcessed) {
        return;
      }

      return this.info.totalBytesProcessed // TODO
    }
  },
  methods: {
    runAsQuery () {
      this.queryStatus = 'runningAsQuery'

      call ({
        command: 'runAsQuery',
      });
    },

    displayResult (result) {
      this.activeTag = 'table'
      this.queryStatus = 'done'
      this.info = result.info
      this.table = result.table
      this.json = result.json
      this.detail = result.detail
    },

    displayValue (value) {
      if (value === null) {
        return 'NULL';
      } else {
        return value;
      }
    },

    cancelQuery () {
      this.queryStatus = 'none'

      call ({
        command: 'cancelQuery',
      });
    },

    didCancelQuery () {
      this.queryStatus = 'none'
    },

    displayError (errorMessage) {
      this.queryStatus = 'error'
      this.errorMessage = errorMessage
    }
  },
});

window.addEventListener ('message', event => {
  switch (event.data.command) {
    case 'runAsQuery':
      vueApp.displayResult(event.data.result);
      break;
    case 'queryError':
      vueApp.displayError(event.data.errorMessage);
      break;
    case 'cancelQuery':
      vueApp.didCancelQuery();
      break;
  }
});
