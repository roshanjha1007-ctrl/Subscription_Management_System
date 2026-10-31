from backend.database.collections import (
    users_collection,
    subscriptions_collection,
)

def create_indexes():
    users_collection.create_index("email", unique=True)
    subscriptions_collection.create_index("subscriptionNumber", unique=True)
    subscriptions_collection.create_index("status")
    subscriptions_collection.create_index("customerId")
    subscriptions_collection.create_index("nextInvoiceDate")
    print("Database indexes created successfully!")
