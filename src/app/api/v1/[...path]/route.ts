import { Errors } from "@/lib/errors";
import { handler } from "@/lib/http";

// Unknown /api/v1 paths still answer with the contract's JSON error shape.
const notFound = handler(async () => {
  throw Errors.notFound("Endpoint");
});

export { notFound as GET, notFound as POST, notFound as PATCH, notFound as PUT, notFound as DELETE };
