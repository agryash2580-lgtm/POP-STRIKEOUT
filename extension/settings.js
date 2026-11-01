PopAPI.storage.local.get("server").then((x) => {
  location.replace((x.server || Pop.defaultServer) + "/?pop-settings=1");
});
