import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  ThumbsUp, 
  ThumbsDown, 
  CheckCircle, 
  XCircle,
  Flag,
  Reply,
  Trash2,
  Send,
  AlertCircle,
  Info,
  Lightbulb,
  HelpCircle,
  Check,
  X
} from 'lucide-react';
import '../styles/AnnotationsPanel.css';

function AnnotationsPanel({ datasetId, user, onAnnotationAdded }) {
  const [annotations, setAnnotations] = useState([]);
  const [newAnnotation, setNewAnnotation] = useState('');
  const [annotationType, setAnnotationType] = useState('general');
  const [isLoading, setIsLoading] = useState(true);
  const [replyTo, setReplyTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const annotationTypes = [
    { value: 'general', label: 'General', icon: <Info size={16} />, color: '#3b82f6' },
    { value: 'insight', label: 'Insight', icon: <Lightbulb size={16} />, color: '#f59e0b' },
    { value: 'question', label: 'Question', icon: <HelpCircle size={16} />, color: '#8b5cf6' },
    { value: 'caution', label: 'Caution', icon: <AlertCircle size={16} />, color: '#ef4444' },
    { value: 'methodology', label: 'Methodology', icon: <Info size={16} />, color: '#10b981' }
  ];

  useEffect(() => {
    loadAnnotations();
  }, [datasetId, showResolved]);

  const loadAnnotations = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/datasets/${datasetId}/annotations?includeResolved=${showResolved}`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnnotations(data.annotations);
      }
    } catch (error) {
      console.error('Error loading annotations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAnnotation = async () => {
    if (!newAnnotation.trim()) return;
    
    try {
      const response = await fetch(`/api/datasets/${datasetId}/annotations`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          annotation_text: newAnnotation,
          annotation_type: annotationType,
          parent_annotation_id: replyTo?.annotation_id || null
        })
      });
      
      if (response.ok) {
        setNewAnnotation('');
        setReplyTo(null);
        setReplyText('');
        loadAnnotations();
        if (onAnnotationAdded) onAnnotationAdded();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to add annotation');
      }
    } catch (error) {
      console.error('Error adding annotation:', error);
      alert('Error adding annotation');
    }
  };

  const handleVote = async (annotationId, voteType) => {
    try {
      const response = await fetch(`/api/annotations/${annotationId}/vote`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ vote_type: voteType })
      });
      
      if (response.ok) {
        loadAnnotations();
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleResolve = async (annotationId) => {
    try {
      const response = await fetch(`/api/annotations/${annotationId}/resolve`, {
        method: 'PUT',
        credentials: 'include'
      });
      
      if (response.ok) {
        loadAnnotations();
      }
    } catch (error) {
      console.error('Error resolving annotation:', error);
    }
  };

  const handleDelete = async (annotationId) => {
    if (!window.confirm('Are you sure you want to delete this annotation?')) return;
    
    try {
      const response = await fetch(`/api/annotations/${annotationId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        loadAnnotations();
      }
    } catch (error) {
      console.error('Error deleting annotation:', error);
    }
  };

  const getTypeIcon = (type) => {
    const typeConfig = annotationTypes.find(t => t.value === type);
    return typeConfig?.icon || <Info size={16} />;
  };

  const getTypeColor = (type) => {
    const typeConfig = annotationTypes.find(t => t.value === type);
    return typeConfig?.color || '#6b7280';
  };

  const AnnotationItem = ({ annotation, isReply = false }) => {
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [localReplyText, setLocalReplyText] = useState('');
    
    const handleReply = async () => {
      if (!localReplyText.trim()) return;
      
      try {
        const response = await fetch(`/api/datasets/${datasetId}/annotations`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            annotation_text: localReplyText,
            annotation_type: 'general',
            parent_annotation_id: annotation.annotation_id
          })
        });
        
        if (response.ok) {
          setLocalReplyText('');
          setShowReplyInput(false);
          loadAnnotations();
        }
      } catch (error) {
        console.error('Error adding reply:', error);
      }
    };
    
    return (
      <div className={`annotation-item ${isReply ? 'reply' : ''} ${annotation.is_resolved ? 'resolved' : ''}`}>
        <div className="annotation-header">
          <div className="annotation-user">
            {annotation.user_picture ? (
              <img src={annotation.user_picture} alt={annotation.user_name} className="annotation-avatar" />
            ) : (
              <div className="annotation-avatar-placeholder">
                {annotation.user_name?.[0] || 'U'}
              </div>
            )}
            <div className="annotation-user-info">
              <span className="annotation-user-name">{annotation.user_name}</span>
              <span className="annotation-time">
                {new Date(annotation.created_at).toLocaleDateString()} at{' '}
                {new Date(annotation.created_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
          
          <div className="annotation-badges">
            <span 
              className="annotation-type-badge"
              style={{ backgroundColor: getTypeColor(annotation.annotation_type) + '20', color: getTypeColor(annotation.annotation_type) }}
            >
              {getTypeIcon(annotation.annotation_type)}
              <span>{annotationTypes.find(t => t.value === annotation.annotation_type)?.label}</span>
            </span>
            
            {annotation.is_resolved && (
              <span className="resolved-badge">
                <CheckCircle size={14} />
                Resolved
              </span>
            )}
          </div>
        </div>
        
        <div className="annotation-text">
          {annotation.annotation_text}
        </div>
        
        <div className="annotation-actions">
          <button className="vote-btn" onClick={() => handleVote(annotation.annotation_id, 'upvote')}>
            <ThumbsUp size={14} />
            <span>{annotation.upvotes || 0}</span>
          </button>
          
          <button className="vote-btn" onClick={() => handleVote(annotation.annotation_id, 'downvote')}>
            <ThumbsDown size={14} />
            <span>{annotation.downvotes || 0}</span>
          </button>
          
          {!isReply && (
            <button className="reply-btn" onClick={() => setShowReplyInput(!showReplyInput)}>
              <Reply size={14} />
              <span>Reply {annotation.reply_count > 0 && `(${annotation.reply_count})`}</span>
            </button>
          )}
          
          {(user?.id === annotation.user_id || user?.role === 'admin') && (
            <>
              <button className="resolve-btn" onClick={() => handleResolve(annotation.annotation_id)}>
                {annotation.is_resolved ? <XCircle size={14} /> : <CheckCircle size={14} />}
                <span>{annotation.is_resolved ? 'Unresolve' : 'Resolve'}</span>
              </button>
              
              <button className="delete-btn" onClick={() => handleDelete(annotation.annotation_id)}>
                <Trash2 size={14} />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
        
        {showReplyInput && (
          <div className="reply-input-container">
            <textarea
              value={localReplyText}
              onChange={(e) => setLocalReplyText(e.target.value)}
              placeholder="Write a reply..."
              rows={2}
            />
            <div className="reply-input-actions">
              <button className="cancel-btn" onClick={() => setShowReplyInput(false)}>
                <X size={16} />
                Cancel
              </button>
              <button className="submit-reply-btn" onClick={handleReply}>
                <Send size={16} />
                Reply
              </button>
            </div>
          </div>
        )}
        
        {annotation.replies && annotation.replies.length > 0 && (
          <div className="annotation-replies">
            {annotation.replies.map(reply => (
              <AnnotationItem key={reply.annotation_id} annotation={reply} isReply={true} />
            ))}
          </div>
        )}
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <div className="annotations-loading">
        <div className="loading-spinner-small"></div>
        <p>Loading comments...</p>
      </div>
    );
  }
  
  return (
    <div className="annotations-panel">
      <div className="annotations-header">
        <div className="header-left">
          <MessageSquare size={20} />
          <h3>Discussion & Annotations</h3>
          <span className="annotation-count">{annotations.length} comments</span>
        </div>
        
        <div className="header-right">
          <label className="show-resolved-toggle">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(e) => setShowResolved(e.target.checked)}
            />
            <span>Show resolved</span>
          </label>
        </div>
      </div>
      
      <div className="new-annotation-form">
        <div className="annotation-type-selector">
          {annotationTypes.map(type => (
            <button
              key={type.value}
              className={`type-btn ${annotationType === type.value ? 'active' : ''}`}
              onClick={() => setAnnotationType(type.value)}
              style={{
                borderColor: annotationType === type.value ? type.color : '#e5e7eb',
                backgroundColor: annotationType === type.value ? type.color + '10' : 'transparent'
              }}
            >
              {type.icon}
              <span>{type.label}</span>
            </button>
          ))}
        </div>
        
        <textarea
          value={newAnnotation}
          onChange={(e) => setNewAnnotation(e.target.value)}
          placeholder="Add a comment, question, or insight about this dataset..."
          rows={3}
        />
        
        <div className="form-actions">
          {replyTo && (
            <div className="replying-to">
              <span>Replying to {replyTo.user_name}</span>
              <button onClick={() => setReplyTo(null)}>
                <X size={14} />
              </button>
            </div>
          )}
          <button 
            className="submit-annotation-btn"
            onClick={handleAddAnnotation}
            disabled={!newAnnotation.trim()}
          >
            <Send size={16} />
            Post Comment
          </button>
        </div>
      </div>
      
      <div className="annotations-list">
        {annotations.length === 0 ? (
          <div className="no-annotations">
            <MessageSquare size={48} />
            <p>No comments yet. Be the first to start the discussion!</p>
          </div>
        ) : (
          annotations.map(annotation => (
            <AnnotationItem key={annotation.annotation_id} annotation={annotation} />
          ))
        )}
      </div>
    </div>
  );
}

export default AnnotationsPanel;