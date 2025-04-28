import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../CSS/Auth.css";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const navigate = useNavigate();

  const validate = () => {
    const newErrors = {};

    // Email validation
    if (!email) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Password validation
    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    } else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      newErrors.password = "Password must contain both letters and numbers";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const response = await axios.post("http://localhost:8080/auth/register", {
        email,
        password,
      });

      if (response.data.message) {
        setShowVerificationMessage(true);
      }
    } catch (error) {
      if (error.response) {
        alert(error.response.data.message || error.response.data || "Signup failed");
      } else {
        alert("Network error. Please try again.");
      }
    }
  };
  const resendVerification = async () => {
    try {
      await axios.post("http://localhost:8080/auth/resend-verification", null, {
        params: { email }
      });
      alert("Verification email resent!");
    } catch (error) {
      alert(error.response?.data || "Failed to resend verification email");
    }
  };


  const handleGoogleSignup = async (credentialResponse) => {
    try {
      const response = await axios.post("http://localhost:8080/auth/google", {
        token: credentialResponse.credential,
      });
      localStorage.setItem("token", response.data.token);
      navigate("/dashboard");
    } catch (error) {
      alert(error.response?.data?.message || "Google signup failed");
    }
  };

  useEffect(() => {
    const initializeGoogleSignIn = () => {
      if (window.google && window.google.accounts) {
        window.google.accounts.id.initialize({
          client_id: "475177334034-ufjdi8pebqvbgf9ogv0gs85nq9588a8m.apps.googleusercontent.com",
          callback: handleGoogleSignup,
        });
        window.google.accounts.id.renderButton(
          document.getElementById("googleSignUpButton"),
          { theme: "outline", size: "large" }
        );
      } else {
        setTimeout(initializeGoogleSignIn, 100);
      }
    };
    initializeGoogleSignIn();
  }, []);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>VideoCraft</h1>
          <p>Professional Video Editing</p>
        </div>
        <h2>Signup</h2>

        {showVerificationMessage ? (
          <div className="verification-message">
            <p>We've sent a verification email to {email}</p>
            <p>Please check your inbox and verify your email before logging in.</p>
            <button onClick={resendVerification} className="auth-button">
              Resend Verification Email
            </button>
            <p className="auth-link">
              Already verified? <a href="/">Login</a>
            </p>
          </div>
        ) : (
          <>
    <form onSubmit={handleSignup} className="auth-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`auth-input ${errors.email ? 'error' : ''}`}
          />
          {errors.email && <div className="error-message">{errors.email}</div>}

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`auth-input ${errors.password ? 'error' : ''}`}
          />
          {errors.password && <div className="error-message">{errors.password}</div>}

          <button type="submit" className="auth-button">Sign Up</button>
        </form>
            <div className="divider">OR</div>
            <div id="googleSignUpButton" className="google-button"></div>
            <p className="auth-link">
              Already have an account? <a href="/">Login</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Signup;