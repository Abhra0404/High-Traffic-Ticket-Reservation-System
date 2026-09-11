import crypto from "node:crypto";

export function requestId(req, res, next) {
  const incomingId = req.get("X-Request-ID");

  const id =
    incomingId?.trim() || crypto.randomUUID();

  req.requestId = id;

  res.setHeader("X-Request-ID", id);

  next();
}
