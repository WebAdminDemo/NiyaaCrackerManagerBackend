export function requestTimeout(ms = 30000) {
  return (req, res, next) => {
    res.setTimeout(ms, () => {
      if (!res.headersSent)
        res.status(504).json({ message: "Request timed out" });
    });
    next();
  };
}
