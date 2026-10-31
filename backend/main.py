from database.connection import test_connection
from database.indexes import create_indexes

if __name__ == "__main__":
    test_connection()
    create_indexes()
