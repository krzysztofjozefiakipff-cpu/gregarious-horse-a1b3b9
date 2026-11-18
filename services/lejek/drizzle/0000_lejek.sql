CREATE TABLE accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, salon TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('admin','manager','seller')));
--> statement-breakpoint
CREATE TABLE results (person INTEGER NOT NULL REFERENCES accounts(id), month TEXT NOT NULL, source INTEGER NOT NULL, counters TEXT NOT NULL, PRIMARY KEY(person, month, source));
--> statement-breakpoint
CREATE TABLE plans (person INTEGER NOT NULL REFERENCES accounts(id), month TEXT NOT NULL, target INTEGER NOT NULL, PRIMARY KEY(person, month));
