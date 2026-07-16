import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Transformer } from 'react-konva';

// URLImage component with enforced aspect ratio
const URLImage = ({ image, onSelect, isSelected, onDragEnd }) => {
  const shapeRef = useRef();
  const trRef = useRef();

  // Compute the original aspect ratio from the image (if loaded)
  const aspectRatio =
    image && image.naturalWidth && image.naturalHeight
      ? image.naturalWidth / image.naturalHeight
      : 1;

  useEffect(() => {
    if (isSelected && trRef.current) {
      // Attach transformer to the image
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        image={image}
        ref={shapeRef}
        onClick={onSelect}
        onTap={onSelect}
        draggable
        onDragEnd={(e) => onDragEnd && onDragEnd(e.target.x(), e.target.y())}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          // This boundBoxFunc ensures the image keeps its aspect ratio
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            const diffWidth = Math.abs(newBox.width - oldBox.width);
            const diffHeight = Math.abs(newBox.height - oldBox.height);
            if (diffWidth > diffHeight) {
              newBox.height = newBox.width / aspectRatio;
            } else {
              newBox.width = newBox.height * aspectRatio;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

// EditableText component remains the same
const EditableText = ({ id, text, x, y, fontSize, onChange, onSelect, isSelected }) => {
  const textRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current) {
      trRef.current.nodes([textRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <Text
        text={text}
        x={x}
        y={y}
        fontSize={fontSize}
        draggable
        ref={textRef}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange(id, e.target.x(), e.target.y())}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};

const CertificateEditor = ({ predefinedText, inputs }) => {
  // Certificate Template state
  const [templateImage, setTemplateImage] = useState(null);
  const [imageObj, setImageObj] = useState(null);

  // Additional Images state – array of image objects
  const [additionalImages, setAdditionalImages] = useState([]);

  // Editable text items state
  const [texts, setTexts] = useState([]);

  // Currently selected element's id (works for text or image)
  const [selectedId, setSelectedId] = useState(null);

  // Toggle state for the side panel
  const [showPanel, setShowPanel] = useState(true);

  // Refs and stage dimensions
  const stageRef = useRef();
  const containerRef = useRef();
  const additionalImagesInputRef = useRef(null);
  const [stageWidth, setStageWidth] = useState(800);
  const [stageHeight, setStageHeight] = useState(600);

  // Update stage width based on container's width only if no template is loaded
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && !templateImage) {
        setStageWidth(containerRef.current.offsetWidth);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [templateImage]);

  // Load certificate template image and update stage dimensions to match
  useEffect(() => {
    if (templateImage) {
      const img = new window.Image();
      img.src = templateImage;
      img.onload = () => {
        setImageObj(img);
        setStageWidth(img.naturalWidth);
        setStageHeight(img.naturalHeight);
      };
    }
  }, [templateImage]);

  // Handle certificate template file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        setTemplateImage(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle additional images file input
  const handleAdditionalImageChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const dataUrl = evt.target.result;
        const img = new window.Image();
        img.src = dataUrl;
        img.onload = () => {
          const newId = `image-${Date.now()}-${Math.random()}`;
          setAdditionalImages((prev) => [
            ...prev,
            {
              id: newId,
              dataUrl,
              imageObj: img,
              x: 50,
              y: 50,
            },
          ]);
          setSelectedId(newId);
        };
      };
      reader.readAsDataURL(file);
    });
    if (additionalImagesInputRef.current) {
      additionalImagesInputRef.current.value = "";
    }
  };

  // Add new editable text item
  const addText = () => {
    const newText = {
      id: `text-${Date.now()}`,
      text: 'New Text',
      x: 50,
      y: 50,
      fontSize: 24,
    };
    setTexts((prev) => [...prev, newText]);
    setSelectedId(newText.id);
  };

  // Update text position
  const updateTextPosition = (id, newX, newY) => {
    setTexts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, x: newX, y: newY } : t))
    );
  };

  // Update text properties (content, font size, etc.) from side panel
  const handleTextChange = (id, field, value) => {
    setTexts((prev) =>
      prev.map((text) => (text.id === id ? { ...text, [field]: value } : text))
    );
  };

  // Update additional image position
  const updateImagePosition = (id, newX, newY) => {
    setAdditionalImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, x: newX, y: newY } : img))
    );
  };

  // Delete selected element (text or additional image)
  const deleteSelectedElement = () => {
    if (texts.find((t) => t.id === selectedId)) {
      setTexts((prev) => prev.filter((t) => t.id !== selectedId));
    } else if (additionalImages.find((img) => img.id === selectedId)) {
      setAdditionalImages((prev) =>
        prev.filter((img) => img.id !== selectedId)
      );
    }
    setSelectedId(null);
  };

  // Determine selected text or image (if any)
  const selectedText = texts.find((t) => t.id === selectedId);
  const selectedImage = additionalImages.find((img) => img.id === selectedId);

  return (
    <div className="p-5" style={{ position: 'relative' }}>
      <h2 className="p-1 text-3xl font-semibold">Certificate Editor</h2>
      {/* Upload and control panel */}
      <div className="flex flex-col items-end justify-center">
        <div className="flex gap-5 items-center justify-end">
          <label>Select Template</label>
          <input
            className="bg-blue-300 p-2 shadow-sm rounded-lg"
            type="file"
            onChange={handleFileChange}
            accept="image/*"
          />
        </div>
        <br />
        <div className="flex gap-5 items-center justify-end">
          <label>Add Images</label>
          <input
            ref={additionalImagesInputRef}
            className="bg-green-300 p-2 shadow-sm rounded-lg mt-2"
            type="file"
            onChange={handleAdditionalImageChange}
            accept="image/*"
            multiple
          />
        </div>
        <br />
        <button
          className="border-blue-500 text-blue-500 border px-2 py-1 rounded-sm shadow-lg hover:bg-blue-500 hover:text-white mt-2 w-fit"
          onClick={addText}
        >
          Add Text
        </button>
      </div>

      {/* Toggle Side Panel Button */}
      <div style={{ marginTop: '10px' }}>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className="border px-2 py-1 rounded-sm shadow-lg hover:bg-gray-200"
        >
          {showPanel ? 'Hide Panel' : 'Show Panel'}
        </button>
      </div>

      {/* Controls for editing selected elements (inline on canvas) */}
      {(selectedText || selectedImage) && (
        <div style={{ marginTop: '10px' }}>
          {selectedText && (
            <>
              <input
                type="text"
                value={selectedText.text}
                onChange={(e) =>
                  handleTextChange(selectedText.id, 'text', e.target.value)
                }
                placeholder="Edit text"
                style={{ marginRight: '10px' }}
              />
              <input
                type="number"
                value={selectedText.fontSize}
                onChange={(e) =>
                  handleTextChange(
                    selectedText.id,
                    'fontSize',
                    Number(e.target.value)
                  )
                }
                placeholder="Font size"
                style={{ width: '80px', marginRight: '10px' }}
              />
            </>
          )}
          <button onClick={deleteSelectedElement}>Delete Selected Element</button>
        </div>
      )}

      {/* Main content area: Canvas */}
      <div style={{ position: 'relative', marginTop: '10px', overflow: 'hidden' }}>
        {/* Canvas Container */}
        <div
          ref={containerRef}
          style={{
            flex: 2,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'auto',
            maxWidth: 'calc(100vw - 320px)' // leave space for the panel if needed
          }}
        >
          <Stage
            width={stageWidth}
            height={stageHeight}
            ref={stageRef}
            className="border-2 border-slate-300"
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedId(null);
              }
            }}
          >
            <Layer>
              {/* Certificate Template Image (background) */}
              {imageObj && (
                <URLImage
                  image={imageObj}
                  onSelect={() => setSelectedId('template')}
                  isSelected={selectedId === 'template'}
                />
              )}

              {/* Predefined text rendered with fixed dimensions */}
              {predefinedText && (
                <Text
                  text={inputs.filter((x) => x.field === "name" || x.field === "Name")}
                  x={predefinedText.x}
                  y={predefinedText.y}
                  fontSize={predefinedText.fontSize || 24}
                  fill={predefinedText.fill || 'black'}
                  draggable={false}
                  width={predefinedText.width || 300}
                  height={predefinedText.height || 100}
                  align="center"
                  verticalAlign="middle"
                />
              )}

              {/* Render Additional Images */}
              {additionalImages.map((img) => (
                <URLImage
                  key={img.id}
                  image={img.imageObj}
                  onSelect={() => setSelectedId(img.id)}
                  isSelected={selectedId === img.id}
                  onDragEnd={(x, y) => updateImagePosition(img.id, x, y)}
                />
              ))}

              {/* Render Editable Text Items */}
              {texts.map((t) => (
                <EditableText
                  key={t.id}
                  id={t.id}
                  text={t.text}
                  x={t.x}
                  y={t.y}
                  fontSize={t.fontSize}
                  onChange={updateTextPosition}
                  onSelect={() => setSelectedId(t.id)}
                  isSelected={selectedId === t.id}
                />
              ))}
            </Layer>
          </Stage>
        </div>

        {/* Right Side Panel (absolutely positioned) */}
        {showPanel && (
          <div
            style={{
              position: 'absolute',
              right: '10px',
              top: '10px',
              width: '280px',
              background: 'white',
              border: '1px solid #ccc',
              padding: '10px',
              overflow: 'auto',
              maxHeight: 'calc(100vh - 100px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}
          >
            <h3>Input Attributes and Values</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Attribute</th>
                  <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {inputs.map((input, index) => (
                  <tr key={index}>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{input.field}</td>
                    <td style={{ border: '1px solid #ddd', padding: '8px' }}>{input.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <h3 style={{ marginTop: '20px' }}>Dynamic Texts</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Text</th>
                  <th>Size</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {texts.map((text) => (
                  <tr
                    key={text.id}
                    onClick={() => setSelectedId(text.id)}
                    style={{
                      backgroundColor: selectedId === text.id ? '#f0f0f0' : 'white',
                      cursor: 'pointer'
                    }}
                  >
                    <td>
                      <input
                        type="text"
                        value={text.text}
                        onChange={(e) => handleTextChange(text.id, 'text', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={text.fontSize}
                        onChange={(e) =>
                          handleTextChange(text.id, 'fontSize', parseInt(e.target.value))
                        }
                        style={{ width: '60px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={text.x}
                        onChange={(e) => handleTextChange(text.id, 'x', parseInt(e.target.value))}
                        style={{ width: '60px' }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={text.y}
                        onChange={(e) => handleTextChange(text.id, 'y', parseInt(e.target.value))}
                        style={{ width: '60px' }}
                      />
                    </td>
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSelectedElement();
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default CertificateEditor;
