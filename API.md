# API Reference

Base URL for local development:

```text
http://localhost:5000
```

## Routes

- `GET /health` checks server status.
- `GET /appointments?userEmail=<email>` loads appointments for a patient.
- `POST /appointments` creates a new appointment.
- `PATCH /appointments/:id` updates appointment details for the matching patient email.
- `DELETE /appointments/:id?userEmail=<email>` deletes an appointment.
- `GET /reviews?doctorId=<doctorId>` loads reviews for a doctor.
- `GET /reviews?userEmail=<email>` loads reviews by patient email.
- `POST /reviews` creates a review after a verified booking.
