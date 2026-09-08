import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "traineta.db"))
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    for col, definition in [("data_source", "VARCHAR(50) DEFAULT 'SIMULATED'"), ("data_status", "VARCHAR(50) DEFAULT 'LIVE'")]:
        try:
            cur.execute(f"ALTER TABLE train_positions ADD COLUMN {col} {definition}")
            print(f"Added column {col} to train_positions in {db_path}")
        except Exception as e:
            print(f"Column {col}: {e}")
    conn.commit()
    conn.close()
    print("traineta.db schema synchronization complete.")
else:
    print(f"No database found at {db_path}")
