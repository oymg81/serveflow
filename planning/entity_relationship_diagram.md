# Entity Relationship Diagram

This diagram outlines the database schema for ServeFlow, showing the 1:N and N:M relationships between our core tables.

```mermaid
erDiagram
    USERS {
        int id PK
        string name
        string email
        string role "Admin or Volunteer"
        int ministry_id FK
        timestamp created_at
    }

    MINISTRIES {
        int id PK
        string title "e.g., Kids, Media"
        string description
    }

    EVENTS {
        int id PK
        string name "e.g., Sunday Service 9AM"
        date event_date
        time start_time
        time end_time
    }

    ASSIGNMENTS {
        int id PK
        int user_id FK
        int event_id FK
        string status "Pending, Confirmed"
        timestamp created_at
    }

    MINISTRIES ||--o{ USERS : "has many (1:N)"
    USERS ||--o{ ASSIGNMENTS : "joins (N:M part 1)"
    EVENTS ||--o{ ASSIGNMENTS : "includes (N:M part 2)"
```

### Table Descriptions
- **Users**: Stores all accounts. The `role` column differentiates Admins from Volunteers.
- **Ministries**: Contains the different service areas available.
- **Events**: Stores the specific service times or church events.
- **Assignments**: This is our **Join Table** enabling the many-to-many relationship between Users and Events. It also includes the `status` to track if a volunteer has confirmed their participation.
