import {
  getAllEvents,
  getEventById,
  getEventSeats,
} from "./event.service.js";

export async function listEvents(req, res) {
  const events = await getAllEvents();

  res.status(200).json({
    data: events,
  });
}

export async function getEvent(req, res) {
  const { id } = req.params;

  const event = await getEventById(id);

  if (!event) {
    return res.status(404).json({
      error: "Event not found",
    });
  }

  res.status(200).json({
    data: event,
  });
}

export async function listEventSeats(req, res) {
  const { id } = req.params;

  const event = await getEventById(id);

  if (!event) {
    return res.status(404).json({
      error: "Event not found",
    });
  }

  const seats = await getEventSeats(id);

  res.status(200).json({
    data: seats,
  });
}