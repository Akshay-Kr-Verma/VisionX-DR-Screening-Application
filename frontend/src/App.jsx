import { useState, useEffect} from "react";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

const severityInfo = {
  0: {
    title: "No Diabetic Retinopathy",
    description: "No signs of diabetic retinopathy were detected.",
    className: "level-0",
  },
  1: {
    title: "Mild Diabetic Retinopathy",
    description: "Mild signs of diabetic retinopathy were detected.",
    className: "level-1",
  },
  2: {
    title: "Moderate Diabetic Retinopathy",
    description: "Moderate signs of diabetic retinopathy were detected.",
    className: "level-2",
  },
  3: {
    title: "Severe Diabetic Retinopathy",
    description: "Severe signs of diabetic retinopathy were detected.",
    className: "level-3",
  },
  4: {
    title: "Proliferative Diabetic Retinopathy",
    description: "Advanced signs of diabetic retinopathy were detected.",
    className: "level-4",
  },
};


function App() {
  const [token, setToken] = useState(
    localStorage.getItem("access_token")
  );

  const handleLogin = (accessToken) => {
    localStorage.setItem("access_token", accessToken);
    setToken(accessToken);
  };

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setToken(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <PatientDashboard
      token={token}
      onLogout={handleLogout}
    />
  );
}


function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event) => {
    event.preventDefault();

    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/auth/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Login failed."
        );
      }

      if (data.user.role !== "patient") {
        throw new Error(
          "This login is only for patients."
        );
      }

      onLogin(data.access_token);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="login-page">

      <div className="login-card">

        <div className="login-logo">
          VX
        </div>

        <h1>VisionX-DR</h1>

        <p className="login-subtitle">
          Diabetic Retinopathy Screening
        </p>

        <form onSubmit={handleLogin}>

          <div className="input-group">

            <label>Email</label>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
            />

          </div>


          <div className="input-group">

            <label>Password</label>

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />

          </div>


          {error && (
            <div className="error-message">
              {error}
            </div>
          )}


          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>

        </form>

        <div className="login-note">
          AI-assisted diabetic retinopathy
          screening platform
        </div>

      </div>

    </div>
  );
}


function PatientDashboard({
  token,
  onLogout,
}) {

  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [preview, setPreview] =
    useState(null);

  const [result, setResult] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [analyzing, setAnalyzing] =
    useState(false);

  const [error, setError] =
    useState("");


  const loadDashboard = async () => {

    setLoading(true);
    setError("");

    try {

      const headers = {
        Authorization: `Bearer ${token}`,
      };


      const profileResponse =
        await fetch(
          `${API_URL}/patients/me`,
          {
            headers,
          }
        );


      const profileData =
        await profileResponse.json();


      if (!profileResponse.ok) {
        throw new Error(
          profileData.detail ||
          "Unable to load patient profile."
        );
      }


      setProfile(profileData);


      const historyResponse =
        await fetch(
          `${API_URL}/screenings/me`,
          {
            headers,
          }
        );


      const historyData =
        await historyResponse.json();


      if (!historyResponse.ok) {
        throw new Error(
          historyData.detail ||
          "Unable to load screening history."
        );
      }


      setHistory(historyData);

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }
  };


  // Load dashboard when component starts
  useEffect(() => {
    loadDashboard();
  }, []);


  const handleFileChange = (event) => {

    const file =
      event.target.files[0];

    if (!file) {
      return;
    }

    setSelectedFile(file);

    setPreview(
      URL.createObjectURL(file)
    );

    setResult(null);
    setError("");
  };


  const handleAnalyze = async () => {

    if (!selectedFile) {

      setError(
        "Please select a fundus image."
      );

      return;
    }


    setAnalyzing(true);
    setError("");
    setResult(null);


    const formData =
      new FormData();

    formData.append(
      "image",
      selectedFile
    );


    try {

      const response =
        await fetch(
          `${API_URL}/screenings/predict/me`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            body: formData,
          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        throw new Error(
          data.detail ||
          "Unable to analyze image."
        );

      }


      setResult(data);

      // Refresh history
      await loadDashboard();

    } catch (err) {

      setError(err.message);

    } finally {

      setAnalyzing(false);

    }
  };


  if (loading) {

    return (
      <div className="loading-page">
        <div className="loader"></div>
        <p>Loading your dashboard...</p>
      </div>
    );

  }


  const latest =
    history.length > 0
      ? history[0]
      : null;


  const latestLevel =
    latest?.severity_level;


  return (

    <div className="dashboard">

      {/* HEADER */}

      <header className="dashboard-header">

        <div className="brand">

          <div className="logo">
            VX
          </div>

          <div>
            <h1>VisionX-DR</h1>

            <p>
              Diabetic Retinopathy Screening
            </p>
          </div>

        </div>


        <div className="header-actions">

          <span>
            Patient
          </span>

          <button
            onClick={onLogout}
            className="logout-button"
          >
            Logout
          </button>

        </div>

      </header>


      <main className="dashboard-main">

        {/* WELCOME */}

        <section className="dashboard-welcome">

          <span className="welcome-tag">
            Patient Dashboard
          </span>

          <h2>
            Welcome,{" "}
            {profile?.name || "Patient"}
          </h2>

          <p>
            View your screening results
            and upload a new retinal image.
          </p>

        </section>


        {/* PROFILE */}

        <section className="profile-card">

          <h3>
            Patient Information
          </h3>

          <div className="profile-grid">

            <div>
              <span>Name</span>
              <strong>
                {profile?.name || "-"}
              </strong>
            </div>

            <div>
              <span>Patient ID</span>
              <strong>
                {profile?.patient_id || "-"}
              </strong>
            </div>

            <div>
              <span>Email</span>
              <strong>
                {profile?.email || "-"}
              </strong>
            </div>

            <div>
              <span>Gender</span>
              <strong>
                {profile?.gender || "-"}
              </strong>
            </div>

          </div>

        </section>


        {/* LATEST RESULT */}

        <section className="latest-card">

          <div className="section-heading">

            <div>
              <span className="section-tag">
                Latest
              </span>

              <h3>
                Latest Screening
              </h3>
            </div>

          </div>


          {latest ? (

            <div className="latest-result">

              <div
                className={
                  `latest-level level-${latestLevel}`
                }
              >
                LEVEL {latestLevel}
              </div>


              <div>

                <h4>
                  {latest.prediction}
                </h4>

                <p>
                  Screening ID: #{latest.screening_id}
                </p>

                <p>
                  Confidence:{" "}
                  {latest.confidence}%
                </p>

              </div>

            </div>

          ) : (

            <p className="empty-state">
              No screenings have been
              performed yet.
            </p>

          )}

        </section>


        {/* NEW SCREENING */}

        <section className="screening-card">

          <div className="card-header">

            <div>

              <span className="section-tag">
                AI Screening
              </span>

              <h3>
                New Fundus Screening
              </h3>

              <p>
                Upload a retinal fundus
                image for AI-assisted
                analysis.
              </p>

            </div>

          </div>


          <label
            htmlFor="imageUpload"
            className="upload-area"
          >

            {preview ? (

              <img
                src={preview}
                alt="Fundus preview"
                className="preview-image"
              />

            ) : (

              <div className="upload-placeholder">

                <div className="upload-icon">
                  +
                </div>

                <h4>
                  Upload fundus image
                </h4>

                <p>
                  JPG, JPEG or PNG
                </p>

              </div>

            )}

          </label>


          <input
            id="imageUpload"
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            onChange={handleFileChange}
            hidden
          />


          {error && (

            <div className="error-message">
              {error}
            </div>

          )}


          <button
            className="analyze-button"
            onClick={handleAnalyze}
            disabled={analyzing}
          >

            {analyzing
              ? "Analyzing Image..."
              : "Analyze Image"}

          </button>

        </section>


        {/* NEW RESULT */}

        {result && (

          <section
            className={
              `result-card level-${result.severity_level}`
            }
          >

            <span className="result-label">
              SCREENING RESULT
            </span>

            <h3>
              {result.severity_name}
            </h3>

            <div className="result-grid">

              <div>
                <span>
                  DR Severity Level
                </span>

                <strong>
                  {result.severity_level} / 4
                </strong>
              </div>

              <div>
                <span>
                  Confidence
                </span>

                <strong>
                  {result.confidence}%
                </strong>
              </div>

            </div>

            <p>
              {
                severityInfo[
                  result.severity_level
                ]?.description
              }
            </p>

            <div className="disclaimer">
              This is an AI-assisted screening
              result and not a medical diagnosis.
              Please consult a qualified
              eye-care professional for
              clinical evaluation.
            </div>

          </section>

        )}


        {/* HISTORY */}

        <section className="history-section">

          <div className="section-heading">

            <div>

              <span className="section-tag">
                Patient Records
              </span>

              <h3>
                Screening History
              </h3>

            </div>


            <button
              className="refresh-button"
              onClick={loadDashboard}
            >
              Refresh
            </button>

          </div>


          {history.length === 0 ? (

            <div className="empty-state">
              No screening history available.
            </div>

          ) : (

            <div className="history-list">

              {history.map((screening) => (

                <div
                  className="history-item"
                  key={screening.screening_id}
                >

                  <div
                    className={
                      `history-level level-${screening.severity_level}`
                    }
                  >
                    LEVEL{" "}
                    {screening.severity_level}
                  </div>


                  <div className="history-details">

                    <h4>
                      {screening.prediction}
                    </h4>

                    <p>
                      Screening ID: #
                      {screening.screening_id}
                    </p>

                    <p>
                      Date:{" "}
                      {new Date(
                        screening.screened_at
                      ).toLocaleString()}
                    </p>

                    <p>
                      Image:{" "}
                      {screening.filename}
                    </p>

                  </div>


                  <div className="history-confidence">

                    <strong>
                      {screening.confidence}%
                    </strong>

                    <span>
                      Confidence
                    </span>

                  </div>

                </div>

              ))}

            </div>

          )}

        </section>


        {/* DR SCALE */}

        <section className="scale-section">

          <span className="section-tag">
            Reference
          </span>

          <h3>
            DR Severity Scale
          </h3>


          {Object.entries(severityInfo).map(
            ([level, info]) => (

              <div
                className={
                  `scale-item ${info.className}`
                }
                key={level}
              >

                <strong>
                  {level}
                </strong>

                <div>
                  <b>
                    {info.title}
                  </b>

                  <p>
                    {info.description}
                  </p>
                </div>

              </div>

            )
          )}

        </section>

      </main>


      <footer>

        <strong>
          VisionX-DR Screening Application
        </strong>

        <span>
          AI-assisted diabetic retinopathy screening
        </span>

      </footer>

    </div>
  );
}


export default App;