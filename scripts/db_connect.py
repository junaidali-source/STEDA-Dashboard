"""
Rumi Database Connection Utility
Read-only access to Rumi production PostgreSQL database.
"""

import os
from dotenv import load_dotenv
import pandas as pd
from sqlalchemy import create_engine, text

load_dotenv()

DB_URL = (
    f"postgresql://{os.getenv('DB_USER')}:{os.getenv('DB_PASSWORD')}"
    f"@{os.getenv('DB_HOST')}:{os.getenv('DB_PORT')}/{os.getenv('DB_NAME')}"
    f"?sslmode={os.getenv('DB_SSL', 'require')}"
)


def get_engine():
    """Return a SQLAlchemy engine connected to Rumi DB."""
    return create_engine(DB_URL, connect_args={"connect_timeout": 30})


def query(sql, params=None):
    """Run a SQL query and return a pandas DataFrame."""
    engine = get_engine()
    with engine.connect() as conn:
        return pd.read_sql(text(sql), conn, params=params)


def test_connection():
    """Verify database connectivity."""
    try:
        df = query("SELECT COUNT(*) as total_users FROM users WHERE COALESCE(is_test_user, false) = false")
        print(f"Connected successfully. Total real users: {df['total_users'].iloc[0]:,}")
        return True
    except Exception as e:
        print(f"Connection failed: {e}")
        return False


if __name__ == "__main__":
    test_connection()
