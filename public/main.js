const vscode = acquireVsCodeApi();

async function call (param) {
  return await vscode.postMessage (param);
}

const vueApp = new Vue ({
  el: '#app',
  data: {
    authNeeded: true,
    authorizeUrl: '',
    authCode: '',
    activeTag: 'info',
    queryStatus: 'none',
    sql: null,
    variablesString: '{}',
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
  watch: {
    variablesString (val) {
      if (this._parseVariables()) {
        call ({
          command: 'saveVariables',
          variables: this._parseVariables(),
        });
      }
    }
  },
  methods: {
    setAuthCode () {
      call ({
        command: 'setAuthCode',
        authCode: this.authCode,
      });
    },

    authSuccessed () {
      this.authNeeded = false
    },

    _parseVariables () {
      try {
        return JSON.parse(this.variablesString)
      } catch {
        return null
      }
    },

    openAuthURL () {
      call ({
        command: 'openExternal',
        url: this.authorizeUrl,
      });
    },

    runAsQuery () {
      this.queryStatus = 'runningAsQuery'
      call ({
        command: 'runAsQuery',
        variables: this._parseVariables() || {},
      });
    },

    runAsQuerySelected () {
      this.queryStatus = 'runningAsQuerySelected'
      call ({
        command: 'runAsQuery',
        variables: this._parseVariables() || {},
        onlySelected: true,
      });
    },

    displayResult (result) {
      this.activeTag = 'table'
      this.queryStatus = 'done'
      this.sql = result.sql
      this.info = result.info
      this.table = result.table
      // this.json = result.json
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
    },

    setVariables (variables) {
      this.variablesString = JSON.stringify(variables, null, "  ")
    },

    setAuthorizeUrl (authorizeUrl) {
      this.authorizeUrl = authorizeUrl
    }
  },
});

window.addEventListener ('message', event => {
  switch (event.data.command) {
    case 'setAuthorizeUrl':
      vueApp.setAuthorizeUrl(event.data.authorizeUrl);
      break;
    case 'authSuccessed':
      vueApp.authSuccessed();
      break;
    case 'runAsQuery':
      vueApp.displayResult(event.data.result);
      break;
    case 'queryError':
      vueApp.displayError(event.data.errorMessage);
      break;
    case 'cancelQuery':
      vueApp.didCancelQuery();
      break;
    case 'setVariables':
      vueApp.setVariables(event.data.variables);
      break;
  }
});
