# Endpoints

## 🔐 Auth

### POST /auth/register
*Create a new user account.*

**Request:**
```json
{
  "firstName": "Ana",
  "lastName": "García",
  "email": "ana@school.edu",
  "password": "strongPass123",
  "schoolId": "<uuid>"
}
```
**Response:**
```json
{
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "<uuid>",
      "firstName": "Ana",
      "lastName": "García",
      "email": "ana@school.edu",
      "schoolId": "<uuid>",
      "credits": {
        "balance": 0,
        "locked": 0
      }
    }
  },
  "success": true
}
```

---

### POST /auth/login
*Log in an existing user.*

```json
{
  "email": "ana@school.edu",
  "password": "strongPass123"
}
```

// res
```json
{
  "data": {
    "token":"<jwt>",
    "user":{
      "id":"<uuid>",
      "firstName":"Ana",
      "lastName":"García",
      "email":"ana@school.edu",
      "schoolId":"<uuid>",
      "credits":{
        "balance":0,
        "locked":0
      }
    }
  },
  "success": true
}
```

## 👤 Users

### GET /me
*Get information about the currently logged-in user.*

**Response:**
```json
{
  "data": {
    "id":"<uuid>",
    "firstName":"Sofía",
    "lastName":"López",
    "email":"sofia@...",
    "phone":"+54...",
    "school":{
      "id":"<uuid>",
      "name":"Colegio Belgrano",
      "media":{
        "id":"<uuid>",
        "url":"https://.../belgrano-logo.png",
        "mime":"image/png",
        "createdAt":"2025-08-16T...Z"
      }
    },
    "role":{
      "id":"<uuid>",
      "name":"student"
    },
    "profileMedia":{
      "id":"<uuid>",
      "url":"https://.../avatar.jpg",
      "mime":"image/jpeg",
      "createdAt":"2025-08-16T...Z"
    },
    "credits":{
      "balance":265,
      "locked":85
    }
  },
  "success": true
}
```

---

### PATCH /me
*Update your profile*

**Request:**
```json
{
  "firstName": "Sofía",
  "lastName": "López",
  "email": "sofia@school.edu",
  "phone": "+54...",
  "schoolId": "<uuid>"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "firstName": "Sofía",
    "lastName": "López",
    "email": "sofia@school.edu",
    "phone": "+54...",
    "schoolId": "<uuid>",
    "credits": {
      "balance": 265,
      "locked": 85
    }
  }
}
```

---

### GET /users/:id
*Get information about a specific user.*

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "firstName": "Ana",
    "lastName": "García",
    "email": "ana@school.edu",
    "phone": "+54...",
    "schoolId": "<uuid>",
    "credits": {
      "balance": 0,
      "locked": 0
    }
  },
  "success": true
}
```

---

### GET /users
*Get a list of users. You can filter results using query parameters.*

**Query Parameters:**
- `schoolId` (string, optional): Filter users by school.

...
- `role` (string, optional): Filter users by role (e.g., `student`, `teacher`).
- `search` (string, optional): Search by name or email.
- `limit` (number, optional): Maximum number of users to return.
- `offset` (number, optional): Number of users to skip (for pagination).
- `sort` (string, optional): Sort order (e.g., `price`, `date`).

**Response:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "firstName": "Ana",
      "lastName": "García",
      "email": "ana@school.edu",
      "phone": "+54...",
      "schoolId": "<uuid>",
      "credits": {
        "balance": 0,
        "locked": 0
      }
    },
    // ...
  ],
  "pagination": {
    "total_records": 1,
    "current_page": 1,
    "page_size": 10,
    "total_pages": 1,
    "next_page": null,
    "prev_page": null
  },
  "success": true
}
```

---

### PATCH /users/:id
*Update information about a specific user.*

**Request:**
```json
{
  "firstName": "Ana",
  "lastName": "García",
  "email": "ana@school.edu",
  "phone": "+54...",
  "schoolId": "<uuid>"
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "firstName": "Ana",
    "lastName": "García",
    "email": "ana@school.edu",
    "phone": "+54...",
    "schoolId": "<uuid>",
    "credits": {
      "balance": 0,
      "locked": 0
    }
  },
  "success": true
}
```

---

### POST /admin/users/:id/credits/adjust
*Adjust the credits of a specific user.*

**Request:**
```json
{
  "amount": 50,
  "message": "Welcome Bonus"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "firstName": "Ana",
    "lastName": "García",
    "email": "ana@school.edu",
    "phone": "+54...",
    "schoolId": "<uuid>",
    "credits": {
      "balance": 50,
      "locked": 0
    }
  }
}
```

## 🏫 Schools
### GET /schools/:id
*Get information about a specific school.*

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "name": "Colegio Belgrano",
    "location": "Buenos Aires, Argentina",
    "media": {
      "id": "<uuid>",
      "url": "https://.../belgrano-logo.png",
      "mime": "image/png",
      "createdAt": "2025-08-16T...Z"
    }
  },
  "success": true
}
```
---

### GET /schools
*Get a list of schools.*

**Response:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "name": "Colegio Belgrano",
      "location": "Buenos Aires, Argentina",
      "media": {
        "id": "<uuid>",
        "url": "https://.../belgrano-logo.png",
        "mime": "image/png",
        "createdAt": "2025-08-16T...Z"
      }
    },
    // ...
  ],
  "pagination": {
    "total_records": 1,
    "current_page": 1,
    "page_size": 10,
    "total_pages": 1,
    "next_page": null,
    "prev_page": null
  },
  "success": true
}
```

---

### PATCH /admin/schools
*Update information about a specific school.*

**Request:**
```json
{
  "name": "Colegio Belgrano",
  "location": "Buenos Aires, Argentina"
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "name": "Colegio Belgrano",
    "location": "Buenos Aires, Argentina",
    "media": {
      "id": "<uuid>",
      "url": "https://.../belgrano-logo.png",
      "mime": "image/png",
      "createdAt": "2025-08-16T...Z"
    }
  },
  "success": true
}
```

## Roles
### GET /roles
*Get a list of roles.*

**Response:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "name": "Admin"
    },
    {
      "id": "<uuid>",
      "name": "Teacher"
    },
    {
      "id": "<uuid>",
      "name": "Student"
    }
  ],
  "success": true
}
```

---

### POST /admin/roles
*Create a new role.*

**Request:**
```json
{
  "name": "New Role"
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "name": "New Role"
  },
  "success": true
}
```

---

### PATCH /admin/roles/:id
*Update information about a specific role.*

**Request:**
```json
{
  "name": "Updated Role"
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "name": "Updated Role"
  },
  "success": true
}
```

## 📁 Categories
### GET /categories
*Get a list of categories.*

**Response:**
```json
{
  "data": [
    {
      "id":"<uuid>",
      "name":"Uniforms",
      "description":"...",
      "icon":"tshirt",
      "priceRange":{
        "min":50,
        "max":300
      },
      "stats":{
        "kgWaste":0.8,
        "kgCo2":3.2,
        "lH2o":200
      },
      "parentId":null,
      "children":[
        {
          "id":"<uuid>",
          "name":"Shirts",
          "description":"...",
          "icon":"shirt",
          "priceRange":{
            "min":60,
            "max":180
          },
          "stats":{
            "kgWaste":0.5,
            "kgCo2":2.0,
            "lH2o":120
          },
          "parentId":"<uuid>"
        }
      ]
    }
  ],
  "success": true
}
```

---

### POST /admin/categories
*Create a new category.*

**Request:**
```json
{
  "name": "New Category",
  "description": "Description of the new category",
  "icon": "category_icon",
  "priceRange": {
    "min": 0,
    "max": 1000
  },
  "stats": {
    "kgWaste": 0,
    "kgCo2": 0,
    "lH2o": 0
  },
  "parentId": null
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "name": "New Category",
    "description": "Description of the new category",
    "icon": "category_icon",
    "priceRange": {
      "min": 0,
      "max": 1000
    },
    "stats": {
      "kgWaste": 0,
      "kgCo2": 0,
      "lH2o": 0
    },
    "parentId": null
  },
  "success": true
}
```

---

### PATCH /admin/categories/:id
*Update information about a specific category.*

**Request:**
```json
{
  "name": "Updated Category",
  "description": "Updated description",
  "icon": "updated_icon",
  "priceRange": {
    "min": 10,
    "max": 900
  },
  "stats": {
    "kgWaste": 0.1,
    "kgCo2": 0.5,
    "lH2o": 10
  },
  "parentId": null
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "name": "Updated Category",
    "description": "Updated description",
    "icon": "updated_icon",
    "priceRange": {
      "min": 10,
      "max": 900
    },
    "stats": {
      "kgWaste": 0.1,
      "kgCo2": 0.5,
      "lH2o": 10
    },
    "parentId": null
  },
  "success": true
}
```

## 🛒 Listings
### GET /listings
*Get a list of listings. You can filter results using query parameters.*

**Query Parameters:**
- `schoolId` (string, optional): Filter listings by school.

...
- `search` (string, optional): Search by name or email.
- `limit` (number, optional): Maximum number of listings to return.
- `offset` (number, optional): Number of listings to skip (for pagination).
- `sort` (string, optional): Sort order (e.g., `price`, `date`).


**Response:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "title": "Listing Title",
      "description": "Listing Description",
      "price": 100,
      "category": {
        "id": "<uuid>",
        "name": "Category Name"
      },
      "school": {
        "id": "<uuid>",
        "name": "School Name"
      }
    }
  ],
  "success": true,
  "pagination": {
    "total_records": 1,
    "current_page": 1,
    "page_size": 10,
    "total_pages": 1,
    "next_page": null,
    "prev_page": null
  }
}
```

---

### GET /listings/:id
*Get details about a specific listing.*

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "title": "Listing Title",
    "description": "Listing Description",
    "price": 100,
    "category": {
      "id": "<uuid>",
      "name": "Category Name"
    },
    "school": {
      "id": "<uuid>",
      "name": "School Name"
    }
  },
  "success": true
}
```

---

### POST /listings
*Create a new listing.*

**Request:**
```json
{
  "title": "New Listing",
  "description": "Description of the new listing",
  "price": 100,
  "categoryId": "<uuid>",
  "schoolId": "<uuid>",
  "media": [
    {
      "id": "<uuid>",
      "url": "https://example.com/image.jpg",
      "type": "image"
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "title": "New Listing",
    "description": "Description of the new listing",
    "price": 100,
    "category": {
      "id": "<uuid>",
      "name": "Category Name"
    },
    "school": {
      "id": "<uuid>",
      "name": "School Name"
    }
  },
  "success": true
}
```

---

### PATCH /listings/:id
*Update a specific listing.*

**Request:**
```json
{
  "title": "Updated Listing",
  "description": "Updated description",
  "price": 150,
  "categoryId": "<uuid>",
  "schoolId": "<uuid>",
  "media": [
    {
      "id": "<uuid>",
      "url": "https://example.com/updated_image.jpg",
      "type": "image"
    }
  ]
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "title": "Updated Listing",
    "description": "Updated description",
    "price": 150,
    "category": {
      "id": "<uuid>",
      "name": "Category Name"
    },
    "school": {
      "id": "<uuid>",
      "name": "School Name"
    }
  },
  "success": true
}
```

--- 

### POST /listings/:id/offer
*Make an offer on a specific listing.*

**Request:**
```json
{
  "offeredCredits": 90
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "listingId": "<uuid>",
    "offeredCredits": 90,
    "status": "pending"
  },
  "success": true
}
```

---
### POST /listings/:id/offer/cancel
*Cancel an offer on a specific listing (auth buyer).*

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "listingId": "<uuid>",
    "status": "cancelled"
  },
  "success": true
}
```

---

### POST /listings/:id/offer/accept
*Seller accepts an offer. Locks buyer credits; sets status to accepted.*

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "listingId": "<uuid>",
    "offeredCredits": 90,
    "status": "accepted"
  },
  "success": true
}
```

---

### POST /listings/:id/offer/reject
*Seller rejects an offer. Clears buyer & offeredCredits; status returns to published.*

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "listingId": "<uuid>",
    "offeredCredits": null,
    "buyerId": null,
    "status": "published"
  },
  "success": true
}
```

---

### POST /listings/:id/received
*Buyer confirms item received. Finalizes: transfers credits, sets status to received, writes wallet transactions.*

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "listingId": "<uuid>",
    "offeredCredits": 90,
    "status": "received",
    "walletTransaction": {
      "id": "<uuid>",
      "fromUserId": "<buyer-uuid>",
      "toUserId": "<seller-uuid>",
      "amount": 90,
      "type": "transfer"
    }
  },
  "success": true
}
```

<!-- TODO: ADD WALLET TRANSACTION DETAILS -->

## 🎯 Missions
### GET /admin/missions/templates
*Get a list of mission templates. For Admins*

**Response:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "title": "Mission Title",
      "description": "Mission Description",
      "reward": 100
    }
  ],
  "success": true
}
```

---

### POST /admin/missions/templates
*Create a new mission template.*

**Request:**
```json
{
  "title": "New Mission",
  "description": "Description of the new mission",
  "reward": 100
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "title": "New Mission",
    "description": "Description of the new mission",
    "reward": 100
  },
  "success": true
}
```

---

### PATCH /admin/missions/templates/:id
*Update a mission template.*

**Request:**
```json
{
  "title": "Updated Mission",
  "description": "Updated description",
  "reward": 150
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "title": "Updated Mission",
    "description": "Updated description",
    "reward": 150
  },
  "success": true
}
```

---

### GET /me/missions
*Get a list of missions for the authenticated user.*

**Response:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "title": "Mission Title",
      "description": "Mission Description",
      "reward": 100
    }
  ],
  "success": true
}
```

## 🔔 Notifications
### GET /me/notifications
*Get a list of notifications for the authenticated user.*

**Response:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "type": "mission",
      "message": "You have a new mission available.",
      "createdAt": "<timestamp>"
    }
  ],
  "success": true
}
```

---

### POST /me/notifications/read-all
*Mark all notifications as read.*

**Response:**
```json
{
  "data": {
    "success": true
  },
  "success": true
}
```

## 📨 Messages
### GET /me/messages
*Get a list of chats for the authenticated user.*

**Response:**
```json
{
  "data": [
    {
      "id": "<uuid>",
      "senderId": "<uuid>",
      "receiverId": "<uuid>",
      "content": "Hello, this is a message.",
      "createdAt": "<timestamp>"
    }
  ],
  "success": true,
  "pagination": {
    "total_records": 1,
    "current_page": 1,
    "page_size": 10,
    "total_pages": 1,
    "next_page": null,
    "prev_page": null
  },
}
```

---

### POST /me/messages/:id
*Send a new message to a specific user.*

**Request:**
```json
{
  "receiverId": "<uuid>",
  "content": "Hello, this is a message."
}
```

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "senderId": "<uuid>",
    "receiverId": "<uuid>",
    "content": "Hello, this is a message.",
    "createdAt": "<timestamp>"
  },
  "success": true
}
```

---

### GET /me/messages/:id
*Get the messages with a specific user.*

**Response:**
```json
{
  "data": {
    "id": "<uuid>",
    "senderId": "<uuid>",
    "receiverId": "<uuid>",
    "content": "Hello, this is a message.",
    "createdAt": "<timestamp>"
  },
  "success": true,
  "pagination": {
    "total_records": 1,
    "current_page": 1,
    "page_size": 10,
    "total_pages": 1,
    "next_page": null,
    "prev_page": null
  },
}
```

