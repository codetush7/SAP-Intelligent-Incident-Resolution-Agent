sap.ui.define([], function () {
  "use strict";

  // Mirrors frontend/src/services/api.js: same env var name and default,
  // same bearer-token storage key, same 401 -> logout behavior.
  var API_BASE = (window["sap-ui-config"] && window["sap-ui-config"].apiUrl)
    || window.__CPI_API_URL__
    || "http://localhost:5000";

  var TOKEN_KEY = "auth_token";

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  function request(method, path, body, params) {
    var url = API_BASE + "/api" + path;
    if (params) {
      var qs = Object.keys(params)
        .filter(function (k) { return params[k] !== undefined && params[k] !== null; })
        .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); })
        .join("&");
      if (qs) { url += "?" + qs; }
    }

    var headers = { "Content-Type": "application/json" };
    var token = getToken();
    if (token) { headers.Authorization = "Bearer " + token; }

    return fetch(url, {
      method: method,
      headers: headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    }).then(function (res) {
      if (res.status === 401) {
        setToken(null);
        // Route back to login rather than a hard reload, so router state can
        // handle it uniformly; App.js-level equivalent lives in Component.init.
        if (window.location.hash !== "#/login") {
          window.location.hash = "#/login";
        }
        return Promise.reject(new Error("Session expired. Please log in again."));
      }
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var message = (data && data.error) || res.statusText || "Request failed";
          return Promise.reject(new Error(message));
        }
        return data;
      });
    }).catch(function (err) {
      if (err instanceof TypeError) {
        // network failure / timeout
        return Promise.reject(new Error("Network error — could not reach the backend."));
      }
      return Promise.reject(err);
    });
  }

  var ApiService = {
    getToken: getToken,
    setToken: setToken,

    auth: {
      login: function (data) { return request("POST", "/auth/login", data); },
      signup: function (data) { return request("POST", "/auth/signup", data); },
      me: function () { return request("GET", "/auth/me"); }
    },

    dashboard: {
      getStats: function () { return request("GET", "/dashboard/stats"); },
      getTrends: function () { return request("GET", "/dashboard/trends"); }
    },

    tickets: {
      getAll: function (params) { return request("GET", "/tickets", undefined, params); },
      getById: function (id) { return request("GET", "/tickets/" + id); },
      create: function (data) { return request("POST", "/tickets", data); },
      update: function (id, data) { return request("PATCH", "/tickets/" + id, data); },
      remove: function (id) { return request("DELETE", "/tickets/" + id); },
      fix: function (id, data) { return request("POST", "/tickets/" + id + "/fix", data || {}); },
      syncServiceNow: function (id) { return request("POST", "/tickets/" + id + "/sync-servicenow"); },
      syncJira: function (id) { return request("POST", "/tickets/" + id + "/sync-jira"); }
    },

    monitoring: {
      getStatus: function () { return request("GET", "/monitoring/status"); },
      getLogs: function (limit) { return request("GET", "/monitoring/logs", undefined, { limit: limit }); },
      getAlerts: function () { return request("GET", "/monitoring/alerts"); },
      acknowledgeAlert: function (id) { return request("POST", "/monitoring/alerts/" + id + "/acknowledge"); },
      triggerScan: function () { return request("POST", "/monitoring/trigger-scan"); },
      getIflows: function () { return request("GET", "/monitoring/iflows"); },
      start: function () { return request("POST", "/monitoring/start"); },
      stop: function () { return request("POST", "/monitoring/stop"); }
    },

    agent: {
      chat: function (messages) { return request("POST", "/agent/chat", { messages: messages }); },
      simulate: function (scenario) { return request("POST", "/agent/simulate", { scenario: scenario }); },
      processIncident: function (data) { return request("POST", "/agent/process-incident", data); },
      getLogs: function () { return request("GET", "/agent/logs"); }
    },

    analysis: {
      analyze: function (data) { return request("POST", "/analysis/analyze", data); },
      getScenarios: function () { return request("GET", "/analysis/scenarios"); }
    },

    tenants: {
      getAll: function () { return request("GET", "/tenants"); },
      create: function (data) { return request("POST", "/tenants", data); },
      test: function (id) { return request("POST", "/tenants/" + id + "/test"); },
      update: function (id, data) { return request("PATCH", "/tenants/" + id, data); },
      activate: function (id) { return request("POST", "/tenants/" + id + "/activate"); },
      remove: function (id) { return request("DELETE", "/tenants/" + id); }
    },

    jira: {
      get: function () { return request("GET", "/jira"); },
      connect: function (data) { return request("POST", "/jira", data); },
      test: function () { return request("POST", "/jira/test"); },
      disconnect: function () { return request("DELETE", "/jira"); }
    }
  };

  return ApiService;
});
