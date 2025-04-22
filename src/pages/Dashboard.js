import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import '../CSS/Dashboard.css';
import { FaTrash } from 'react-icons/fa';

const API_BASE_URL = 'http://localhost:8080';

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [fps, setFps] = useState(25); // New state for FPS
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [userProfile, setUserProfile] = useState({
    firstName: '',
    lastName: '',
    picture: null,
  });
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    fetchProjects();
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('No token found, redirecting to login');
        navigate('/');
        return;
      }
      const response = await axios.get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const fullName = response.data.name || '';
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      setUserProfile({
        firstName: firstName,
        lastName: lastName,
        picture: response.data.picture || null,
      });
    } catch (error) {
      console.error('Error fetching user profile:', error);
      if (error.response?.status === 401) {
        navigate('/');
      }
      setUserProfile({ firstName: '', lastName: '', picture: null });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsProfileDropdownOpen(false);
    navigate('/');
  };

  const generateVideoThumbnail = async (videoPath) => {
    const fullVideoPath = `${API_BASE_URL}/videos/${encodeURIComponent(videoPath.split('/').pop())}`;
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = fullVideoPath;
      video.muted = true;
      video.preload = 'metadata';

      video.onloadeddata = () => {
        video.currentTime = 1;
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 200;
        const maxHeight = 112;
        let width = video.videoWidth;
        let height = video.videoHeight;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(video, 0, 0, width, height);
        const thumbnail = canvas.toDataURL('image/jpeg');
        resolve(thumbnail);
      };

      video.onerror = () => {
        console.error(`Failed to load video for thumbnail: ${fullVideoPath}`);
        resolve(null);
      };
    });
  };

  const generateImageThumbnail = async (projectId, imagePath) => {
    const filename = imagePath.split('/').pop();
    const fullImagePath = `${API_BASE_URL}/projects/${projectId}/images/${encodeURIComponent(filename)}`;
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = fullImagePath;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxWidth = 200;
        const maxHeight = 112;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        const thumbnail = canvas.toDataURL('image/jpeg');
        resolve(thumbnail);
      };
      img.onerror = () => {
        console.error(`Failed to load image for thumbnail: ${fullImagePath}`);
        resolve(null);
      };
    });
  };

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found. User might not be authenticated.');
        navigate('/');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const projectList = response.data;

      const projectsWithThumbnails = await Promise.all(
        projectList.map(async (project) => {
          const projectDetails = await axios.get(`${API_BASE_URL}/projects/${project.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const timelineState = projectDetails.data.timelineState
            ? typeof projectDetails.data.timelineState === 'string'
              ? JSON.parse(projectDetails.data.timelineState)
              : projectDetails.data.timelineState
            : { segments: [], imageSegments: [] };

          const allSegments = [
            ...(timelineState.segments || []),
            ...(timelineState.imageSegments || []),
          ].sort((a, b) => a.timelineStartTime - b.timelineStartTime);

          let thumbnail = null;
          if (allSegments.length > 0) {
            const firstSegment = allSegments[0];
            if (firstSegment.sourceVideoPath) {
              thumbnail = await generateVideoThumbnail(firstSegment.sourceVideoPath);
            } else if (firstSegment.imagePath) {
              thumbnail = await generateImageThumbnail(project.id, firstSegment.imagePath);
            }
          }

          return { ...project, thumbnail };
        })
      );

      setProjects(projectsWithThumbnails);
    } catch (error) {
      console.error('Error fetching user projects:', error);
      if (error.response?.status === 401) {
        navigate('/');
      }
    }
  };

  const createNewProject = async () => {
    if (!newProjectName) {
      alert('Please enter a project name.');
      return;
    }

    if (fps <= 0 || fps > 120) {
      alert('FPS must be between 1 and 120.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found. User might not be authenticated.');
        navigate('/');
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/projects`,
        {
          name: newProjectName,
          width: width,
          height: height,
          fps: fps, // Include FPS in the request
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProjects([...projects, { ...response.data, thumbnail: null }]);
      setNewProjectName('');
      setWidth(1920);
      setHeight(1080);
      setFps(25); // Reset FPS to default
      setIsDropdownOpen(false);
      navigate(`/projecteditor/${response.data.id}`);
    } catch (error) {
      console.error('Error creating project:', error);
      if (error.response?.status === 401) {
        navigate('/');
      } else if (error.response?.status === 400) {
        alert('Invalid project parameters: ' + error.response.data);
      } else {
        alert('Failed to create project');
      }
    }
  };

  const deleteProject = async (projectId) => {
    const confirmDelete = window.confirm('Are you sure about deleting this Project?');
    if (!confirmDelete) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No token found. User might not be authenticated.');
        navigate('/');
        return;
      }

      await axios.delete(`${API_BASE_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setProjects(projects.filter((project) => project.id !== projectId));
    } catch (error) {
      console.error('Error deleting project:', error);
      if (error.response?.status === 401) {
        navigate('/');
      } else if (error.response?.status === 403) {
        alert('Unauthorized to delete this project');
      } else if (error.response?.status === 404) {
        alert('Project not found');
      } else {
        alert('Failed to delete project');
      }
    }
  };

  const loadProject = (projectId) => {
    navigate(`/projecteditor/${projectId}`);
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  const handlePresetSelect = (presetWidth, presetHeight, presetFps = 25) => {
    setWidth(presetWidth);
    setHeight(presetHeight);
    setFps(presetFps); // Set FPS for the preset
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="product-name">VideoCraft</h1>
        </div>
        <div className="header-right">
          <div className="create-dropdown">
            <button className="create-button" onClick={toggleDropdown}>
              <span className="plus-icon">+</span> Create
            </button>
            {isDropdownOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-title">Create New Project</div>
                <div className="dropdown-form">
                  <input
                    type="text"
                    placeholder="Project Name"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="dropdown-input"
                  />
                  <div className="dimension-inputs">
                    <input
                      type="number"
                      placeholder="Width"
                      value={width}
                      onChange={(e) => setWidth(parseInt(e.target.value, 10))}
                      className="dropdown-input dimension-input"
                    />
                    <input
                      type="number"
                      placeholder="Height"
                      value={height}
                      onChange={(e) => setHeight(parseInt(e.target.value, 10))}
                      className="dropdown-input dimension-input"
                    />
                    <input
                      type="number"
                      placeholder="FPS"
                      value={fps}
                      onChange={(e) => setFps(parseInt(e.target.value, 10))}
                      className="dropdown-input dimension-input"
                    />
                  </div>
                </div>
                <div className="dropdown-presets">
                  <div className="dropdown-subtitle">Presets</div>
                  <div className="dropdown-item" onClick={() => handlePresetSelect(1920, 1080, 30)}>
                    YouTube (1920x1080, 30 FPS)
                  </div>
                  <div className="dropdown-item" onClick={() => handlePresetSelect(1080, 1920, 60)}>
                    YouTube Shorts (1080x1920, 60 FPS)
                  </div>
                  <div className="dropdown-item" onClick={() => handlePresetSelect(1080, 1920, 60)}>
                    Instagram Reels (1080x1920, 60 FPS)
                  </div>
                  <div className="dropdown-item" onClick={() => handlePresetSelect(1080, 1920, 60)}>
                    TikTok (1080x1920, 60 FPS)
                  </div>
                  <div className="dropdown-subtitle">FPS Options</div>
                  <div className="dropdown-item" onClick={() => setFps(24)}>
                    24 FPS (Cinematic)
                  </div>
                  <div className="dropdown-item" onClick={() => setFps(25)}>
                    25 FPS (Standard)
                  </div>
                  <div className="dropdown-item" onClick={() => setFps(30)}>
                    30 FPS (Common)
                  </div>
                  <div className="dropdown-item" onClick={() => setFps(60)}>
                    60 FPS (Smooth)
                  </div>
                </div>
                <button className="dropdown-create-button" onClick={createNewProject}>
                  Create
                </button>
              </div>
            )}
          </div>
          <div className="profile-section">
            <div className="profile-icon" onClick={toggleProfileDropdown}>
              {userProfile.picture ? (
                <img src={userProfile.picture} alt="Profile" className="profile-picture" />
              ) : (
                <div className="default-profile-icon">
                  {userProfile.firstName && userProfile.firstName.length > 0
                    ? userProfile.firstName.charAt(0).toUpperCase()
                    : 'U'}
                </div>
              )}
            </div>
            {isProfileDropdownOpen && (
              <div className="profile-dropdown">
                <div className="profile-name">
                  {(userProfile.firstName || userProfile.lastName)
                    ? `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim()
                    : 'Unknown User'}
                </div>
                <div className="profile-dropdown-item" onClick={handleLogout}>
                  Logout
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <section className="projects-section">
        <h2>My Projects</h2>
        {location.state?.error && <p className="error-message">{location.state.error}</p>}
        <div className="project-grid">
          {projects.length === 0 ? (
            <p className="no-projects">No projects yet. Create one to get started!</p>
          ) : (
            projects.map((project) => (
              <div key={project.id} className="project-card">
                <div className="thumbnail-container" onClick={() => loadProject(project.id)}>
                  {project.thumbnail ? (
                    <img
                      src={project.thumbnail}
                      alt={`${project.name} thumbnail`}
                      className="project-thumbnail"
                    />
                  ) : (
                    <div className="thumbnail-placeholder">No Preview Available</div>
                  )}
                  <div
                    className="delete-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteProject(project.id);
                    }}
                    title="Delete Project"
                  >
                    <FaTrash />
                  </div>
                </div>
                <h3 className="project-title">{project.name}</h3>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;