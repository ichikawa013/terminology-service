// api/routes/timeline.js
import { getTimeline } from "../../middleware/firebaseStore.js";

export default async function timelineRoutes(fastify) {
  // Get patient timeline
  fastify.get("/patients/:id/timeline", async (req, reply) => {
    const { id: patientId } = req.params;

    if (!patientId) {
      return reply.code(400).send({ error: "Patient ID is required" });
    }

    try {
      const timeline = await getTimeline(patientId);

      if (!timeline || timeline.length === 0) {
        return reply.code(404).send({
          message: `No timeline entries found for patient ${patientId}`,
        });
      }

      return reply.send({
        patientId,
        timeline,
      });
    } catch (err) {
      console.error("❌ Error retrieving timeline:", err);
      return reply
        .code(500)
        .send({ error: "Internal Server Error", details: err.message });
    }
  });
}
