import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Slider, Select, Button, Tooltip, Spin, message, Card, Divider, Tag, Space, Row, Col } from 'antd';
import { FilterOutlined, DeleteOutlined, SaveOutlined, EyeOutlined, UndoOutlined } from '@ant-design/icons';

const { Option } = Select;

const API_BASE_URL = 'http://localhost:8080'; // Define base URL


const VideoFilterComponent = ({
  projectId,
  sessionId,
  selectedSegment,
  refreshTimeline,
  token
}) => {
  const [loading, setLoading] = useState(false);
  const [activeFilters, setActiveFilters] = useState([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [currentFilter, setCurrentFilter] = useState({
    type: 'brightness',
    value: 1.0
  });

  // Filter categories with their options
  const filterCategories = {
    adjustments: [
      { name: 'brightness', label: 'Brightness', min: 0, max: 2, step: 0.1, default: 1 },
      { name: 'contrast', label: 'Contrast', min: 0, max: 2, step: 0.1, default: 1 },
      { name: 'saturation', label: 'Saturation', min: 0, max: 3, step: 0.1, default: 1 },
      { name: 'gamma', label: 'Gamma', min: 0.1, max: 3, step: 0.1, default: 1 },
      { name: 'hue', label: 'Hue Rotation', min: 0, max: 360, step: 5, default: 0 }
    ],
    colorEffects: [
      { name: 'sepia', label: 'Sepia', min: 0, max: 1, step: 0.1, default: 0 },
      { name: 'grayscale', label: 'Grayscale', min: 0, max: 1, step: 0.1, default: 0 },
      { name: 'negative', label: 'Negative', preset: true },
      { name: 'colorbalance', label: 'Color Balance', complex: true }
    ],
    stylistic: [
      { name: 'vignette', label: 'Vignette', min: 0, max: 1, step: 0.1, default: 0 },
      { name: 'blur', label: 'Blur', min: 0, max: 10, step: 0.5, default: 0 },
      { name: 'sharpen', label: 'Sharpen', min: 0, max: 5, step: 0.5, default: 0 },
      { name: 'noise', label: 'Film Grain', min: 0, max: 0.5, step: 0.01, default: 0 }
    ],
    presets: [
      { name: 'cinematic', label: 'Cinematic', preset: true },
      { name: 'vintage', label: 'Vintage', preset: true },
      { name: 'cool', label: 'Cool Tone', preset: true },
      { name: 'warm', label: 'Warm Tone', preset: true },
      { name: 'highcontrast', label: 'High Contrast', preset: true }
    ]
  };

  // Map filter values to actual FFmpeg filters
  const getFFmpegFilter = (type, value) => {
    const filters = {
      brightness: `eq=brightness=${value}`,
      contrast: `eq=contrast=${value}`,
      saturation: `eq=saturation=${value}`,
      gamma: `eq=gamma=${value}`,
      hue: `hue=h=${value}`,
      sepia: `colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131:0`,
      grayscale: value === 1 ? 'colorchannelmixer=.3:.4:.3:0:.3:.4:.3:0:.3:.4:.3:0' : `colorchannelmixer=${0.3+(0.7*(1-value))}:${0.4+(0.6*(1-value))}:${0.3+(0.7*(1-value))}:0:${0.3+(0.7*(1-value))}:${0.4+(0.6*(1-value))}:${0.3+(0.7*(1-value))}:0:${0.3+(0.7*(1-value))}:${0.4+(0.6*(1-value))}:${0.3+(0.7*(1-value))}:0`,
      negative: 'negate',
      vignette: `vignette=angle=PI/4:aspect=1:dithering=1:eval=frame:x0=0.5:y0=0.5:opacity=${value}`,
      blur: `boxblur=${value}:${value}`,
      sharpen: `unsharp=${value}:${value}:${value}:${value}:${value}:0`,
      noise: `noise=alls=${value*10}:allf=t`,
      cinematic: 'curves=master="0/0.05 0.3/0.3 0.8/0.8 1/0.9",eq=saturation=0.85:gamma=1.1',
      vintage: 'curves=master="0/0.1 0.5/0.5 1/0.9",hue=s=0.6,curves=r="0/0.05 0.4/0.4 1/0.9":g="0/0.05 0.45/0.39 1/0.93":b="0/0.05 0.45/0.39 1/0.85"',
      cool: 'colorbalance=rs=0:gs=0:bs=0.05:rm=0:gm=0:bm=0.01:rh=0:gh=0:bh=0.01',
      warm: 'colorbalance=rs=0.07:gs=0.02:bs=-0.05:rm=0.05:gm=0.01:bm=-0.05:rh=0.03:gh=0.01:bh=-0.03',
      highcontrast: 'eq=contrast=1.5:brightness=-0.05:saturation=1.2',
      colorbalance: `colorbalance=rs=${(value?.rs || 0)}:gs=${(value?.gs || 0)}:bs=${(value?.bs || 0)}:rm=${(value?.rm || 0)}:gm=${(value?.gm || 0)}:bm=${(value?.bm || 0)}:rh=${(value?.rh || 0)}:gh=${(value?.gh || 0)}:bh=${(value?.bh || 0)}`
    };

    return filters[type] || '';
  };

  useEffect(() => {
    if (selectedSegment && sessionId) {
      fetchActiveFilters();
    }
  }, [selectedSegment, sessionId]);

  const fetchActiveFilters = async () => {
    if (!selectedSegment || !sessionId) return;

    setLoading(true);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/projects/${projectId}/segment/${selectedSegment.id}/filters`,
        {
          params: { sessionId },
          headers: { Authorization: token }
        }
      );
      setActiveFilters(response.data || []);
    } catch (error) {
      console.error('Failed to fetch filters:', error);
      message.error('Failed to load active filters');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterTypeChange = (value) => {
    const filterInfo = Object.values(filterCategories)
      .flat()
      .find(filter => filter.name === value);

    setCurrentFilter({
      type: value,
      value: filterInfo?.default || (filterInfo?.min !== undefined ? filterInfo.min : 0)
    });
  };

  const handleValueChange = (value) => {
    setCurrentFilter(prev => ({
      ...prev,
      value: value
    }));
  };

  const applyFilter = async () => {
    if (!selectedSegment || !sessionId) {
      message.warning('Please select a video segment first');
      return;
    }

    setLoading(true);
    try {
      const ffmpegFilter = getFFmpegFilter(currentFilter.type, currentFilter.value);
      await axios.post(
        `${API_BASE_URL}/projects/${projectId}/apply-filter`,
        {
          videoPath: selectedSegment.sourceVideoPath,
          segmentId: selectedSegment.id,
          filter: ffmpegFilter
        },
        {
          params: { sessionId },
          headers: { Authorization: token }
        }
      );
      message.success(`Applied ${currentFilter.type} filter`);
      fetchActiveFilters();
      if (refreshTimeline) refreshTimeline();
    } catch (error) {
      console.error('Failed to apply filter:', error);
      message.error('Failed to apply filter');
    } finally {
      setLoading(false);
    }
  };

  const removeFilter = async (filterId) => {
    if (!selectedSegment || !sessionId) return;

    setLoading(true);
    try {
      await axios.delete(
        `${API_BASE_URL}/projects/${projectId}/segment/${selectedSegment.id}/filter/${filterId}`,
        {
          params: { sessionId },
          headers: { Authorization: token }
        }
      );
      message.success('Filter removed');
      fetchActiveFilters();
      if (refreshTimeline) refreshTimeline();
    } catch (error) {
      console.error('Failed to remove filter:', error);
      message.error('Failed to remove filter');
    } finally {
      setLoading(false);
    }
  };

  const renderFilterControl = () => {
    const filterInfo = Object.values(filterCategories)
      .flat()
      .find(filter => filter.name === currentFilter.type);

    if (!filterInfo) return null;

    if (filterInfo.preset) {
      return (
        <Button
          type="primary"
          icon={<FilterOutlined />}
          onClick={applyFilter}
        >
          Apply {filterInfo.label} Preset
        </Button>
      );
    }

    if (filterInfo.complex) {
      // For complex filters like colorbalance, we'd need a more advanced UI
      // This is a simplified version
      return (
        <div>
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <div>Shadows:</div>
              <Slider
                min={-1}
                max={1}
                step={0.05}
                value={(currentFilter.value?.rs || 0)}
                onChange={(v) => handleValueChange({
                  ...currentFilter.value, rs: v, gs: v, bs: v
                })}
              />
            </Col>
            <Col span={8}>
              <div>Midtones:</div>
              <Slider
                min={-1}
                max={1}
                step={0.05}
                value={(currentFilter.value?.rm || 0)}
                onChange={(v) => handleValueChange({
                  ...currentFilter.value, rm: v, gm: v, bm: v
                })}
              />
            </Col>
            <Col span={8}>
              <div>Highlights:</div>
              <Slider
                min={-1}
                max={1}
                step={0.05}
                value={(currentFilter.value?.rh || 0)}
                onChange={(v) => handleValueChange({
                  ...currentFilter.value, rh: v, gh: v, bh: v
                })}
              />
            </Col>
          </Row>
          <Button
            type="primary"
            icon={<FilterOutlined />}
            onClick={applyFilter}
            style={{ marginTop: 16 }}
          >
            Apply Color Balance
          </Button>
        </div>
      );
    }

    return (
      <div>
        <Slider
          min={filterInfo.min}
          max={filterInfo.max}
          step={filterInfo.step}
          value={currentFilter.value}
          onChange={handleValueChange}
        />
        <Button
          type="primary"
          icon={<FilterOutlined />}
          onClick={applyFilter}
        >
          Apply Filter
        </Button>
      </div>
    );
  };

  return (
    <Spin spinning={loading}>
      <Card title={<><FilterOutlined /> Video Filters</>} className="filters-panel">
        {selectedSegment ? (
          <>
            <div className="filter-selector">
              <Select
                style={{ width: '100%', marginBottom: 16 }}
                value={currentFilter.type}
                onChange={handleFilterTypeChange}
                placeholder="Select a filter"
              >
                <Option value="" disabled>-- Adjustments --</Option>
                {filterCategories.adjustments.map(filter => (
                  <Option key={filter.name} value={filter.name}>{filter.label}</Option>
                ))}

                <Option value="" disabled>-- Color Effects --</Option>
                {filterCategories.colorEffects.map(filter => (
                  <Option key={filter.name} value={filter.name}>{filter.label}</Option>
                ))}

                <Option value="" disabled>-- Stylistic Effects --</Option>
                {filterCategories.stylistic.map(filter => (
                  <Option key={filter.name} value={filter.name}>{filter.label}</Option>
                ))}

                <Option value="" disabled>-- Presets --</Option>
                {filterCategories.presets.map(filter => (
                  <Option key={filter.name} value={filter.name}>{filter.label}</Option>
                ))}
              </Select>

              {renderFilterControl()}
            </div>

            <Divider />

            <div className="active-filters">
              <h4>Active Filters</h4>
              {activeFilters.length > 0 ? (
                <Space wrap>
                  {activeFilters.map((filter, index) => (
                    <Tag
                      key={index}
                      closable
                      onClose={() => removeFilter(filter.filterId || index)}
                      color="blue"
                    >
                      {filter.name || `Filter ${index + 1}`}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <p>No filters applied</p>
              )}
            </div>
          </>
        ) : (
          <div className="select-segment-prompt">
            <p>Please select a video segment to apply filters</p>
          </div>
        )}
      </Card>
    </Spin>
  );
};

export default VideoFilterComponent;


const loadProjectTimeline = async () => {
    if (!projectId || !sessionId) return;
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const project = response.data;
      if (project && project.timelineState) {
        const timelineState = typeof project.timelineState === 'string' ? JSON.parse(project.timelineState) : project.timelineState;
        const newLayers = [[], [], []];

        // Process video segments
        if (timelineState.segments && timelineState.segments.length > 0) {
          for (const segment of timelineState.segments) {
            const layerIndex = segment.layer || 0;
            while (newLayers.length <= layerIndex) newLayers.push([]);
            if (segment.sourceVideoPath) {
              let videoFileName = segment.sourceVideoPath;
              const normalizedVideoPath = videoFileName.startsWith('videos/') ? videoFileName.substring(7) : videoFileName;
              let video = videos.find(v => {
                const vPath = (v.filePath || v.filename);
                const normalizedVPath = vPath.startsWith('videos/') ? vPath.substring(7) : vPath;
                return normalizedVPath === normalizedVideoPath;
              });
              if (video) {
                newLayers[layerIndex].push({
                  ...video,
                  type: 'video',
                  id: segment.id,
                  startTime: segment.timelineStartTime,
                  duration: segment.timelineEndTime - segment.timelineStartTime,
                  layer: layerIndex,
                  filePath: normalizedVideoPath,
                  positionX: segment.positionX || 0,
                  positionY: segment.positionY || 0,
                  scale: segment.scale || 1,
                  startTimeWithinVideo: segment.startTime,
                  endTimeWithinVideo: segment.endTime,
                });
              }
            }
          }
        }

        // Process image segments
        if (timelineState.imageSegments && timelineState.imageSegments.length > 0) {
          for (const segment of timelineState.imageSegments) {
            const layerIndex = segment.layer || 0;
            while (newLayers.length <= layerIndex) newLayers.push([]);
            const filename = segment.imagePath.split('/').pop();
            const filePath = `${API_BASE_URL}/projects/${projectId}/images/${encodeURIComponent(filename)}`;
            const thumbnail = await generateImageThumbnail(segment.imagePath);
            newLayers[layerIndex].push({
              id: segment.id,
              type: 'image',
              fileName: filename,
              filePath,
              thumbnail,
              startTime: segment.timelineStartTime,
              duration: segment.timelineEndTime - segment.timelineStartTime,
              layer: layerIndex,
              positionX: segment.positionX || 0,
              positionY: segment.positionY || 0,
              scale: segment.scale || 1,
            });
          }
        }

        // Process text segments
        if (timelineState.textSegments && timelineState.textSegments.length > 0) {
          for (const textSegment of timelineState.textSegments) {
            const layerIndex = textSegment.layer || 0;
            while (newLayers.length <= layerIndex) newLayers.push([]);
            newLayers[layerIndex].push({
              id: textSegment.id,
              type: 'text',
              text: textSegment.text,
              startTime: textSegment.timelineStartTime,
              duration: textSegment.timelineEndTime - textSegment.timelineStartTime,
              layer: layerIndex,
              fontFamily: textSegment.fontFamily || 'Arial',
              fontSize: textSegment.fontSize || 24,
              fontColor: textSegment.fontColor || '#FFFFFF',
              backgroundColor: textSegment.backgroundColor || 'transparent',
              positionX: textSegment.positionX || 50,
              positionY: textSegment.positionY || 50,
            });
          }
        }

        setLayers(newLayers);
        setHistory([]);
        setHistoryIndex(-1);
        let maxEndTime = 0;
        newLayers.forEach(layer => {
          layer.forEach(item => {
            const endTime = item.startTime + item.duration;
            if (endTime > maxEndTime) maxEndTime = endTime;
          });
        });
        setTotalDuration(maxEndTime > 0 ? maxEndTime : 0);
      }
    } catch (error) {
      console.error('Error loading project timeline:', error);
    }
  };