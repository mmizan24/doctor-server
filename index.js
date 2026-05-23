const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;
const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "doctor_manager";
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim());

if (!mongoUri) {
  console.error("MONGODB_URI is missing from .env");
  process.exit(1);
}

const client = new MongoClient(mongoUri);
let database;

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json());

const editableAppointmentFields = [
  "patientName",
  "gender",
  "phone",
  "appointmentDate",
  "appointmentTime",
];

const getAppointmentsCollection = () => database.collection("appointments");
const getReviewsCollection = () => database.collection("reviews");

app.get("/", (req, res) => {
  res.send("NavidMediCare server is running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "doctor-server" });
});

app.get("/appointments", async (req, res) => {
  try {
    const { userEmail } = req.query;

    if (!userEmail) {
      return res.status(400).json({ message: "userEmail is required." });
    }

    const appointments = await getAppointmentsCollection()
      .find({ userEmail })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      appointments: appointments.map((appointment) => ({
        ...appointment,
        _id: appointment._id.toString(),
      })),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Failed to load appointments.",
    });
  }
});

app.post("/appointments", async (req, res) => {
  try {
    const appointment = req.body;
    const requiredFields = [
      "userEmail",
      "doctorName",
      "patientName",
      "gender",
      "phone",
      "appointmentDate",
      "appointmentTime",
    ];
    const missingField = requiredFields.find((field) => !appointment[field]);

    if (missingField) {
      return res.status(400).json({ message: `${missingField} is required.` });
    }

    const result = await getAppointmentsCollection().insertOne({
      ...appointment,
      createdAt: new Date(),
    });

    res.status(201).json({
      message: "Appointment booked successfully!",
      insertedId: result.insertedId.toString(),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Failed to book appointment.",
    });
  }
});

app.patch("/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "A valid appointment id is required.",
      });
    }

    if (!updates.userEmail) {
      return res.status(400).json({ message: "userEmail is required." });
    }

    const updatePayload = editableAppointmentFields.reduce((payload, field) => {
      if (updates[field] !== undefined) {
        payload[field] = updates[field];
      }

      return payload;
    }, {});

    const result = await getAppointmentsCollection().findOneAndUpdate(
      { _id: new ObjectId(id), userEmail: updates.userEmail },
      { $set: { ...updatePayload, updatedAt: new Date() } },
      { returnDocument: "after" },
    );

    if (!result) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    res.json({
      message: "Appointment updated successfully!",
      appointment: { ...result, _id: result._id.toString() },
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Failed to update appointment.",
    });
  }
});

app.delete("/appointments/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail } = req.query;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "A valid appointment id is required.",
      });
    }

    if (!userEmail) {
      return res.status(400).json({ message: "userEmail is required." });
    }

    const result = await getAppointmentsCollection().deleteOne({
      _id: new ObjectId(id),
      userEmail,
    });

    if (!result.deletedCount) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    res.json({
      message: "Appointment deleted successfully!",
      deletedId: id,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Failed to delete appointment.",
    });
  }
});

app.get("/reviews", async (req, res) => {
  try {
    const { doctorId, userEmail } = req.query;
    const query = {};

    if (doctorId) {
      query.doctorId = doctorId;
    } else if (userEmail) {
      query.userEmail = userEmail;
    } else {
      return res.status(400).json({
        message: "Either doctorId or userEmail is required.",
      });
    }

    const reviews = await getReviewsCollection()
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();

    res.json({
      reviews: reviews.map((review) => ({
        ...review,
        _id: review._id.toString(),
      })),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Failed to load reviews.",
    });
  }
});

app.post("/reviews", async (req, res) => {
  try {
    const body = req.body;
    const { userEmail, userName, userPhoto, doctorId, doctorName, rating, comment } =
      body;
    const requiredFields = [
      "userEmail",
      "doctorId",
      "doctorName",
      "rating",
      "comment",
    ];
    const missingField = requiredFields.find(
      (field) => body[field] === undefined || body[field] === null || body[field] === "",
    );

    if (missingField) {
      return res.status(400).json({ message: `${missingField} is required.` });
    }

    const appointment = await getAppointmentsCollection().findOne({
      userEmail,
      doctorId,
    });

    if (!appointment) {
      return res.status(403).json({
        message:
          "Permission denied. You can only review a doctor after booking an appointment with them.",
      });
    }

    const result = await getReviewsCollection().insertOne({
      userEmail,
      userName: userName || "Anonymous Patient",
      userPhoto: userPhoto || "",
      doctorId,
      doctorName,
      rating: Number(rating),
      comment,
      createdAt: new Date(),
    });

    res.status(201).json({
      message: "Review added successfully!",
      insertedId: result.insertedId.toString(),
    });
  } catch (error) {
    res.status(500).json({
      message: error.message || "Failed to add review.",
    });
  }
});

const startServer = async () => {
  try {
    await client.connect();
    database = client.db(dbName);

    app.listen(port, () => {
      console.log(`NavidMediCare server running on port ${port}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

startServer();
