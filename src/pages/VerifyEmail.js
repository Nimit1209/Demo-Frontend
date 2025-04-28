import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const verificationToken = searchParams.get('token');
  const [status, setStatus] = useState({ message: 'Verifying your email...', type: 'loading' });
  const isRequestSent = useRef(false);

  useEffect(() => {
    const verifyEmailToken = async () => {
      if (!verificationToken) {
        setStatus({ message: 'Invalid or missing verification token.', type: 'error' });
        setTimeout(() => navigate('/signup', { replace: true, state: { error: 'Invalid or missing verification token' } }), 3000);
        return;
      }

      if (isRequestSent.current) {
        console.log('Request already in progress, skipping...');
        return;
      }

      isRequestSent.current = true;

      try {
        console.log('Sending verification request for token:', verificationToken);
        const response = await axios.get(
          `http://localhost:8080/auth/verify-email?token=${verificationToken}`,
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('Backend response:', response.data);
        const { token, message, isVerified } = response.data;

        if (response.status === 200 && isVerified === true) {
          if (typeof token === 'string' && token.length > 0) {
            console.log('Verification successful, storing JWT token:', token);
            localStorage.setItem('token', token);
          } else {
            console.warn('JWT token missing in response, proceeding without storing token');
          }
          setStatus({ message: message || 'Email verified successfully! Redirecting to dashboard...', type: 'success' });
          setTimeout(() => navigate('/dashboard', { replace: true, state: { message } }), 2000);
        } else {
          console.warn('Invalid response structure:', response.data);
          throw new Error(message || 'Verification failed due to invalid response structure.');
        }
      } catch (error) {
        console.error('Verification error:', error);
        console.log('Error response:', error.response?.data);
        const errorMessage = error.response?.data?.message || 'Email verification failed.';

        if (errorMessage === 'Email has already been verified. Please log in.') {
          setStatus({ message: 'Email already verified. Redirecting to login...', type: 'info' });
          setTimeout(() => navigate('/login', { replace: true, state: { message: errorMessage } }), 2000);
        } else if (errorMessage === 'Invalid or unknown verification token') {
          setStatus({ message: 'This verification link is invalid or has expired. Please request a new one.', type: 'error' });
          setTimeout(() => navigate('/signup', { replace: true, state: { error: errorMessage } }), 3000);
        } else if (errorMessage === 'Verification token has expired. Please request a new verification email.') {
          setStatus({ message: 'This verification link has expired. Please request a new one.', type: 'error' });
          setTimeout(() => navigate('/signup', { replace: true, state: { error: errorMessage } }), 3000);
        } else {
          setStatus({ message: errorMessage, type: 'error' });
          setTimeout(() => navigate('/signup', { replace: true, state: { error: errorMessage } }), 3000);
        }
      } finally {
        isRequestSent.current = false;
      }
    };

    verifyEmailToken();
  }, [verificationToken, navigate]);

  return (
    <div className="verification-container" style={styles.container}>
      <div className="verification-message" style={styles.messageBox}>
        <h2 style={styles.header}>Email Verification</h2>
        <p style={status.type === 'error' ? styles.error : status.type === 'success' ? styles.success : styles.info}>
          {status.message}
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f4f4f9',
  },
  messageBox: {
    backgroundColor: '#fff',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
    textAlign: 'center',
    maxWidth: '400px',
    width: '100%',
  },
  header: {
    marginBottom: '1rem',
    color: '#333',
  },
  error: {
    color: '#d32f2f',
  },
  success: {
    color: '#388e3c',
  },
  info: {
    color: '#0288d1',
  },
};

export default VerifyEmail;