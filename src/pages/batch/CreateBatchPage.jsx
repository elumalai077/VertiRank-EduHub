import { useState } from "react";

const CREATE_BATCH_API =
  "YOUR_CREATE_BATCH_API_URL";

export default function CreateBatchPage() {
  const [batchName, setBatchName] = useState("");
  const [description, setDescription] = useState("");
  const [instruction, setInstruction] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const createBatch = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      setMessage("");

      const token = localStorage.getItem("token");

      const response = await fetch(CREATE_BATCH_API, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batchName,
          description,
          instruction,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      setMessage("Batch created successfully");

      setBatchName("");
      setDescription("");
      setInstruction("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Create Batch</h2>

      <form onSubmit={createBatch}>
        <input
          placeholder="Batch Name"
          value={batchName}
          onChange={(e) => setBatchName(e.target.value)}
          required
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <textarea
          placeholder="Instruction"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
        />

        <button type="submit">
          {loading ? "Creating..." : "Create Batch"}
        </button>
      </form>

      {message && <p>{message}</p>}
      {error && <p>{error}</p>}
    </div>
  );
}