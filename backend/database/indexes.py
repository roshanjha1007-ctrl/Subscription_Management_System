from database.collections import users_collection

def create_indexes():
    users_collection.create_index("email", unique=True)
    print("Database indexes created successfully!")
