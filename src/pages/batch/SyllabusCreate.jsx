import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const API_BASE = "https://j4i5uu85vb.execute-api.ap-south-1.amazonaws.com/dev";

export default function SyllabusManager() {
  const { batchId: routeBatchId } = useParams();
  const navigate = useNavigate();
  
  const [batchId, setBatchId] = useState("");
  const [syllabusName, setSyllabusName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [syllabusId, setSyllabusId] = useState("");
  const [academyId, setAcademyId] = useState("");

  const [units, setUnits] = useState([
    {
      unitName: "",
      weightage: 0,
      topics: [
        {
          topicName: "",
          weightage: 0,
        },
      ],
    },
  ]);

  const token = localStorage.getItem("token");

  // ==========================
  // Get Academy ID from LocalStorage or Context
  // ==========================
  useEffect(() => {
    // Assuming you store academyId in localStorage after login
    const storedAcademyId = localStorage.getItem("academyId");
    if (storedAcademyId) {
      setAcademyId(storedAcademyId);
    }
  }, []);

  // ==========================
  // Fetch Existing Syllabus
  // ==========================
  useEffect(() => {
    if (routeBatchId) {
      setBatchId(routeBatchId);
      fetchSyllabus(routeBatchId);
    } else {
      setError("Batch ID not found in URL");
      setIsLoading(false);
    }
  }, [routeBatchId]);

  const fetchSyllabus = async (batchId) => {
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_BASE}/syllabus/${batchId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (response.status === 404) {
        // Syllabus not found - switch to create mode
        setIsEditMode(false);
        setError("");
        // Reset form for new syllabus
        setSyllabusName("");
        setUnits([
          {
            unitName: "",
            weightage: 0,
            topics: [
              {
                topicName: "",
                weightage: 0,
              },
            ],
          },
        ]);
      } else if (response.ok && data.success) {
        // Syllabus found - populate form for editing
        setIsEditMode(true);
        setSyllabusId(data.syllabus.syllabusId);
        setSyllabusName(data.syllabus.syllabusName);
        setUnits(data.syllabus.units || []);
        setError("");
      } else {
        setError(data.message || "Failed to fetch syllabus");
      }
    } catch (err) {
      setError("Error fetching syllabus: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================
  // Unit Operations
  // ==========================
  const addUnit = () => {
    setUnits([
      ...units,
      {
        unitName: "",
        weightage: 0,
        topics: [
          {
            topicName: "",
            weightage: 0,
          },
        ],
      },
    ]);
  };

  const deleteUnit = (index) => {
    if (units.length <= 1) {
      alert("You need at least one unit");
      return;
    }
    const copy = [...units];
    copy.splice(index, 1);
    setUnits(copy);
  };

  const updateUnit = (index, field, value) => {
    const copy = [...units];
    copy[index][field] = field === "weightage" ? Number(value) || 0 : value;
    setUnits(copy);
  };

  // ==========================
  // Topic Operations
  // ==========================
  const addTopic = (unitIndex) => {
    const copy = [...units];
    copy[unitIndex].topics.push({
      topicName: "",
      weightage: 0,
    });
    setUnits(copy);
  };

  const deleteTopic = (unitIndex, topicIndex) => {
    const copy = [...units];
    if (copy[unitIndex].topics.length <= 1) {
      alert("Each unit must have at least one topic");
      return;
    }
    copy[unitIndex].topics.splice(topicIndex, 1);
    setUnits(copy);
  };

  const updateTopic = (unitIndex, topicIndex, field, value) => {
    const copy = [...units];
    copy[unitIndex].topics[topicIndex][field] =
      field === "weightage" ? Number(value) || 0 : value;
    setUnits(copy);
  };

  // ==========================
  // Validation
  // ==========================
  const validateForm = () => {
    const errors = {};

    if (!batchId.trim()) {
      errors.batchId = "Batch ID is required";
    }
    if (!syllabusName.trim()) {
      errors.syllabusName = "Syllabus Name is required";
    }

    let totalUnitWeightage = 0;

    for (let i = 0; i < units.length; i++) {
      if (!units[i].unitName.trim()) {
        errors[`unit_${i}_name`] = `Unit ${i + 1} name is required`;
      }
      if (units[i].weightage <= 0) {
        errors[`unit_${i}_weightage`] = `Unit ${i + 1} weightage must be greater than 0`;
      }
      totalUnitWeightage += units[i].weightage;

      let totalTopicWeightage = 0;
      for (let j = 0; j < units[i].topics.length; j++) {
        if (!units[i].topics[j].topicName.trim()) {
          errors[`unit_${i}_topic_${j}_name`] = `Topic ${j + 1} in Unit ${i + 1} name is required`;
        }
        if (units[i].topics[j].weightage <= 0) {
          errors[`unit_${i}_topic_${j}_weightage`] = `Topic ${j + 1} in Unit ${i + 1} weightage must be greater than 0`;
        }
        totalTopicWeightage += units[i].topics[j].weightage;
      }

      if (totalTopicWeightage !== units[i].weightage) {
        errors[`unit_${i}_topic_sum`] = `Topic weightages (${totalTopicWeightage}%) must sum to unit weightage (${units[i].weightage}%)`;
      }
    }

    if (totalUnitWeightage !== 100) {
      errors.totalWeightage = `Total unit weightage (${totalUnitWeightage}%) must equal 100%`;
    }

    setValidationErrors(errors);
    setError(Object.values(errors)[0] || "");
    return Object.keys(errors).length === 0;
  };

  // ==========================
  // Submit (Create or Update)
  // ==========================
  const save = async () => {
    setError("");

    if (!validateForm()) {
      return;
    }

    if (!token) {
      setError("Please login first");
      return;
    }

    setLoading(true);

    try {
      let endpoint;
      let method;
      let payload;

      if (isEditMode) {
        // ==========================
        // UPDATE - Use /syllabus-update endpoint
        // ==========================
        endpoint = `${API_BASE}/syllabusedit`;
        method = "PUT";
        
        payload = {
          syllabusId: syllabusId,
          academyId: academyId, // Important: Include academyId
          syllabusName: syllabusName.trim(),
          units: units.map((unit) => ({
            ...unit,
            weightage: Number(unit.weightage),
            topics: unit.topics.map((topic) => ({
              ...topic,
              weightage: Number(topic.weightage),
            })),
          })),
        };
      } else {
        // ==========================
        // CREATE - Use /syllabus-create endpoint
        // ==========================
        endpoint = `${API_BASE}/syllabus-create`;
        method = "POST";
        
        payload = {
          batchId: batchId.trim(),
          syllabusName: syllabusName.trim(),
          academyId: academyId, // Include academyId for creation too
          units: units.map((unit) => ({
            ...unit,
            weightage: Number(unit.weightage),
            topics: unit.topics.map((topic) => ({
              ...topic,
              weightage: Number(topic.weightage),
            })),
          })),
        };
      }

      console.log("Sending payload:", payload);
      console.log("Endpoint:", endpoint);
      console.log("Method:", method);

      const res = await fetch(endpoint, {
        method: method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        alert(
          isEditMode
            ? "Syllabus updated successfully!"
            : "Syllabus created successfully!"
        );
        navigate(`/batch/${batchId}`);
      } else {
        const errorMsg = data.message || `Failed to ${isEditMode ? "update" : "create"} syllabus`;
        setError(errorMsg);
        alert(errorMsg);
      }
    } catch (err) {
      const errorMsg = "Error: " + err.message;
      setError(errorMsg);
      alert(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ==========================
  // Render Loading State
  // ==========================
  if (isLoading) {
    return (
      <div
        style={{
          maxWidth: 900,
          margin: "30px auto",
          fontFamily: "Arial",
          padding: "0 20px",
          textAlign: "center",
        }}
      >
        <h2>Loading Syllabus...</h2>
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              display: "inline-block",
              width: 40,
              height: 40,
              border: "4px solid #f3f3f3",
              borderTop: "4px solid #3498db",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </div>
      </div>
    );
  }

  // ==========================
  // Render Form
  // ==========================
  return (
    <div
      style={{
        maxWidth: 900,
        margin: "30px auto",
        fontFamily: "Arial",
        padding: "0 20px",
      }}
    >
      <h2>{isEditMode ? "Edit Syllabus" : "Create Syllabus"}</h2>

      {/* Batch ID Display */}
      <div
        style={{
          backgroundColor: "#e3f2fd",
          padding: "10px 15px",
          borderRadius: 4,
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>
          <strong>Batch ID:</strong> {batchId || "Not set"}
        </span>
        <div>
          {isEditMode && (
            <span
              style={{
                backgroundColor: "#28a745",
                color: "white",
                padding: "4px 12px",
                borderRadius: 20,
                fontSize: 14,
                marginRight: 10,
              }}
            >
              Editing
            </span>
          )}
          <button
            onClick={() => navigate(`/batch/${batchId}`)}
            style={{
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              padding: "5px 15px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Back to Batch
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: "#ffebee",
            color: "#c62828",
            padding: 10,
            borderRadius: 4,
            marginBottom: 20,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginBottom: 20 }}>
        <label
          style={{ display: "block", marginBottom: 5, fontWeight: "bold" }}
        >
          Syllabus Name *
        </label>
        <input
          style={{
            width: "100%",
            padding: 10,
            border: `1px solid ${
              validationErrors.syllabusName ? "#f44336" : "#ddd"
            }`,
            borderRadius: 4,
          }}
          value={syllabusName}
          onChange={(e) => setSyllabusName(e.target.value)}
          placeholder="Enter syllabus name"
        />
        {validationErrors.syllabusName && (
          <div style={{ color: "#f44336", fontSize: 14, marginTop: 5 }}>
            {validationErrors.syllabusName}
          </div>
        )}
      </div>

      <hr />

      {units.map((unit, unitIndex) => (
        <div
          key={unitIndex}
          style={{
            border: "1px solid #ddd",
            padding: 20,
            marginTop: 20,
            borderRadius: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3>Unit {unitIndex + 1}</h3>
            <button
              onClick={() => deleteUnit(unitIndex)}
              style={{
                backgroundColor: "#dc3545",
                color: "white",
                border: "none",
                padding: "5px 10px",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              Delete Unit
            </button>
          </div>

          <input
            placeholder="Unit Name"
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 10,
              border: `1px solid ${
                validationErrors[`unit_${unitIndex}_name`] ? "#f44336" : "#ddd"
              }`,
              borderRadius: 4,
            }}
            value={unit.unitName}
            onChange={(e) => updateUnit(unitIndex, "unitName", e.target.value)}
          />
          {validationErrors[`unit_${unitIndex}_name`] && (
            <div style={{ color: "#f44336", fontSize: 14, marginBottom: 10 }}>
              {validationErrors[`unit_${unitIndex}_name`]}
            </div>
          )}

          <input
            type="number"
            placeholder="Weightage (%)"
            style={{
              width: "100%",
              padding: 10,
              marginBottom: 10,
              border: `1px solid ${
                validationErrors[`unit_${unitIndex}_weightage`]
                  ? "#f44336"
                  : "#ddd"
              }`,
              borderRadius: 4,
            }}
            value={unit.weightage}
            onChange={(e) =>
              updateUnit(unitIndex, "weightage", e.target.value)
            }
          />
          {validationErrors[`unit_${unitIndex}_weightage`] && (
            <div style={{ color: "#f44336", fontSize: 14, marginBottom: 10 }}>
              {validationErrors[`unit_${unitIndex}_weightage`]}
            </div>
          )}

          <h4>Topics</h4>

          {unit.topics.map((topic, topicIndex) => (
            <div
              key={topicIndex}
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <input
                placeholder="Topic Name"
                style={{
                  flex: 2,
                  minWidth: 150,
                  padding: 10,
                  border: `1px solid ${
                    validationErrors[`unit_${unitIndex}_topic_${topicIndex}_name`]
                      ? "#f44336"
                      : "#ddd"
                  }`,
                  borderRadius: 4,
                }}
                value={topic.topicName}
                onChange={(e) =>
                  updateTopic(
                    unitIndex,
                    topicIndex,
                    "topicName",
                    e.target.value
                  )
                }
              />

              <input
                type="number"
                placeholder="Weightage (%)"
                style={{
                  flex: 1,
                  minWidth: 120,
                  padding: 10,
                  border: `1px solid ${
                    validationErrors[
                      `unit_${unitIndex}_topic_${topicIndex}_weightage`
                    ]
                      ? "#f44336"
                      : "#ddd"
                  }`,
                  borderRadius: 4,
                }}
                value={topic.weightage}
                onChange={(e) =>
                  updateTopic(
                    unitIndex,
                    topicIndex,
                    "weightage",
                    e.target.value
                  )
                }
              />

              <button
                onClick={() => deleteTopic(unitIndex, topicIndex)}
                style={{
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  padding: "8px 15px",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          ))}
          {validationErrors[`unit_${unitIndex}_topic_sum`] && (
            <div style={{ color: "#f44336", fontSize: 14, marginBottom: 10 }}>
              {validationErrors[`unit_${unitIndex}_topic_sum`]}
            </div>
          )}

          <button
            onClick={() => addTopic(unitIndex)}
            style={{
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              padding: "8px 15px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            + Add Topic
          </button>
        </div>
      ))}

      {validationErrors.totalWeightage && (
        <div style={{ color: "#f44336", fontSize: 14, marginTop: 10 }}>
          {validationErrors.totalWeightage}
        </div>
      )}

      <br />

      <button
        onClick={addUnit}
        style={{
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          padding: "10px 20px",
          borderRadius: 4,
          cursor: "pointer",
          marginRight: 10,
        }}
      >
        + Add Unit
      </button>

      <button
        onClick={save}
        disabled={loading || !batchId}
        style={{
          padding: "12px 30px",
          fontSize: 18,
          backgroundColor: loading || !batchId ? "#6c757d" : "#28a745",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: loading || !batchId ? "not-allowed" : "pointer",
          marginTop: 10,
        }}
      >
        {loading
          ? "Saving..."
          : isEditMode
          ? "Update Syllabus"
          : "Create Syllabus"}
      </button>

      <button
        onClick={() => navigate(`/batch/${batchId}`)}
        style={{
          padding: "12px 30px",
          fontSize: 18,
          backgroundColor: "#6c757d",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer",
          marginTop: 10,
          marginLeft: 10,
        }}
      >
        Cancel
      </button>
    </div>
  );
}