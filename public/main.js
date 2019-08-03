const vscode = acquireVsCodeApi ();

async function call (param) {
  return await vscode.postMessage (param);
}

const vueApp = new Vue ({
  el: '#app',
  data: {
    activeTag: 'info',
    queryIsDone: false,
    info: {},
    table: null,
    json: '',
    detail: 'det',
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
      call ({
        command: 'runAsQuery',
      });
    },

    displayResult (result) {
      this.activeTag = 'table';
      this.queryIsDone = true,
      this.info = result.info;
      this.table = result.table;
      this.json = result.json;
      this.detail = result.detail;
    },

    displayValue (value) {
      if (value === null) {
        return 'NULL';
      } else {
        return value;
      }
    },
  },
});

window.addEventListener ('message', event => {
  const message = event.data;

  switch (message.command) {
    case 'runAsQuery':
        vueApp.displayResult (message.result);
  }
});
