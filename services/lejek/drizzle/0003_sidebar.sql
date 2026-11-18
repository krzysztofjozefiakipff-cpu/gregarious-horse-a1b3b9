CREATE TABLE dashboard_sidebar (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  mode TEXT NOT NULL CHECK(mode IN ('cause', 'meme'))
);
