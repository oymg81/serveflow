# Milestone 2 Reflection

**1. What were the most challenging aspects of creating your wireframes and ERD?**
Designing the layout for the volunteer scheduling and event details views was challenging because we needed to ensure the interface was intuitive for both technical and non-technical church volunteers. For the ERD, defining the exact structure of the many-to-many relationship (`ASSIGNMENTS` join table) between `USERS` and `EVENTS` while accounting for "status" (Pending vs. Confirmed) took some careful thought to ensure data integrity.

**2. Did your project scope or features change during this milestone?**
As we laid out the visual flow, we realized that filtering and sorting (one of our custom features) is crucial for the Admin Dashboard to keep it from becoming cluttered as more events are added. We haven't cut any features, but we refined the user journey to focus primarily on clear scheduling actions. 

**3. How did you and your partner divide the work or collaborate on this milestone?**
We collaborated on brainstorming the initial User Stories and Core Features. For this milestone, one of us focused on defining the database schema and constructing the Entity Relationship Diagram, while the other took charge of mocking out the UI wireframes to visualize how the data will be presented to the user. We reviewed both together to ensure they aligned.
