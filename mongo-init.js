// mongo-init.js
db = db.getSiblingDB('traveldb');

// Create a user for the application (optional)
db.createUser({
  user: 'appuser',
  pwd: 'apppassword',
  roles: [
    {
      role: 'readWrite',
      db: 'traveldb'
    }
  ]
});

// Create initial collections if needed
db.createCollection('users');
db.createCollection('tourpackages');
db.createCollection('bookings');

print('Database initialized successfully');