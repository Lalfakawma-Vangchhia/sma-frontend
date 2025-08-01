import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import apiClient from '../services/apiClient';
import { fileToBase64 } from './FacebookUtils';
import './BulkComposer.css';
import { MdAdd, MdSelectAll, MdDelete, MdExpandMore, MdSort } from 'react-icons/md';

// 1. Add promptTemplates as a constant
const promptTemplates = [
  { id: 1, name: 'Daily Motivation', prompt: 'Share an inspiring quote or motivational message for your audience' },
  { id: 2, name: 'Product Showcase', prompt: 'Highlight your best products with engaging descriptions' },
  { id: 3, name: 'Behind the Scenes', prompt: 'Share behind-the-scenes content about your business or team' },
  { id: 4, name: 'Customer Spotlight', prompt: 'Feature customer testimonials or success stories' },
  { id: 5, name: 'Industry Tips', prompt: 'Share valuable tips and insights related to your industry' },
  { id: 6, name: 'Custom', prompt: 'custom' }
];

// Utility function to convert UTC time to IST time for display
// eslint-disable-next-line no-unused-vars
const utcToIstTime = (utcTime) => {
  const [hours, minutes] = utcTime.split(':');
  const date = new Date();
  date.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);

  // Convert to IST (UTC+5:30)
  const istHours = (date.getUTCHours() + 5) % 24;
  const istMinutes = (date.getUTCMinutes() + 30) % 60;
  const addHour = date.getUTCMinutes() + 30 >= 60 ? 1 : 0;
  const finalIstHours = (istHours + addHour) % 24;

  return `${String(finalIstHours).padStart(2, '0')}:${String(istMinutes).padStart(2, '0')}`;
};

// Utility function to convert IST time to UTC for backend
// eslint-disable-next-line no-unused-vars
const istToUtcTime = (istTime) => {
  const [hours, minutes] = istTime.split(':');
  let utcHours = (parseInt(hours) - 5 + 24) % 24;
  let utcMinutes = parseInt(minutes) - 30;

  if (utcMinutes < 0) {
    utcMinutes += 60;
    utcHours = (utcHours - 1 + 24) % 24;
  }

  return `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')}`;
};

// dateStr: "2025-07-17"
// timeStr: "11:17"
// eslint-disable-next-line no-unused-vars
function toISTISOString(dateStr, timeStr) {
  // Create a Date object in the user's local time
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const localDate = new Date(year, month - 1, day, hour, minute);

  // Get the UTC time value
  const utc = localDate.getTime() - (localDate.getTimezoneOffset() * 60000);

  // Offset for IST (+5:30)
  const istOffset = 5.5 * 60 * 60000;
  const istDate = new Date(utc + istOffset);

  // Format as ISO string with +05:30
  const pad = (n) => n.toString().padStart(2, '0');
  const iso =
    `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())}T` +
    `${pad(istDate.getHours())}:${pad(istDate.getMinutes())}:00+05:30`;
  return iso;
}

function BulkComposer({ selectedPage, onClose, availablePages, onPageChange }) {

  const { isAuthenticated } = useAuth();
  const { addNotification } = useNotifications();

  // Strategy step state
  const [strategyData, setStrategyData] = useState({
    promptTemplate: '',
    customStrategyTemplate: '',
    startDate: '',
    endDate: '',
    frequency: 'daily',
    customCron: '',
    timeSlot: '09:00'
  });

  // Composer grid state
  const [composerRows, setComposerRows] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [dragStartRow, setDragStartRow] = useState(null);

  // Calendar preview state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Queue state
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduleProgress, setScheduleProgress] = useState(0);

  // Expanded view state
  const [expandedCaption, setExpandedCaption] = useState(null);
  const [mediaPreviewModal, setMediaPreviewModal] = useState(null);

  // Scheduled posts state
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [loadingScheduledPosts, setLoadingScheduledPosts] = useState(false);
  const [showScheduledPosts, setShowScheduledPosts] = useState(true);
  const [expandedSchedule, setExpandedSchedule] = useState(null);
  const [editingPost, setEditingPost] = useState(null);

  // Add page sync state
  // eslint-disable-next-line no-unused-vars
  const [isCheckingPageSync, setIsCheckingPageSync] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [pageSyncStatus, setPageSyncStatus] = useState('');

  // 1. Add state for pagination and sorting:
  const [schedulePage, setSchedulePage] = useState(1);
  const [scheduleSort, setScheduleSort] = useState('desc'); // 'desc' for newest first, 'asc' for oldest first
  const SCHEDULES_PER_PAGE = 5;

  const initialAutoExpandDone = useRef(false);

  // Group scheduled posts by schedule_batch_id (batch), fallback to date if missing
  const groupedBatches = scheduledPosts.reduce((groups, post) => {
    const batchKey = post.schedule_batch_id || post.scheduled_date;
    if (!groups[batchKey]) {
      groups[batchKey] = [];
    }
    groups[batchKey].push(post);
    return groups;
  }, {});

  // Sort batches by earliest scheduled_date in each batch
  const sortedBatchKeys = Object.keys(groupedBatches).sort((a, b) => {
    const aDate = groupedBatches[a][0]?.scheduled_date || a;
    const bDate = groupedBatches[b][0]?.scheduled_date || b;
    return scheduleSort === 'desc' ? bDate.localeCompare(aDate) : aDate.localeCompare(bDate);
  });
  const totalPages = Math.ceil(scheduledPosts.length / SCHEDULES_PER_PAGE);
  const pagedBatchKeys = sortedBatchKeys.slice((schedulePage - 1) * SCHEDULES_PER_PAGE, schedulePage * SCHEDULES_PER_PAGE);

  const gridRef = useRef(null);

  // Define generateInitialRows before it's used in useEffect
  const generateInitialRows = useCallback(() => {
    if (!strategyData.startDate) return;

    // Create dates in UTC to match backend scheduler
    const startDateParts = strategyData.startDate.split('-');
    const startDate = new Date(Date.UTC(parseInt(startDateParts[0]), parseInt(startDateParts[1]) - 1, parseInt(startDateParts[2])));

    let endDate = null;
    if (strategyData.endDate) {
      const endDateParts = strategyData.endDate.split('-');
      endDate = new Date(Date.UTC(parseInt(endDateParts[0]), parseInt(endDateParts[1]) - 1, parseInt(endDateParts[2])));
    }

    const rows = [];
    const maxDays = 75; // Facebook's 75-day limit
    let currentDate = new Date(startDate);
    let dayCount = 0;
    let rowCount = 0;

    // If no end date is provided, only schedule the start date (single day)
    if (!endDate) {
      const formattedDate = startDate.getUTCFullYear() + '-' +
        String(startDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
        String(startDate.getUTCDate()).padStart(2, '0');

      rows.push({
        id: `row-0`,
        caption: '',
        mediaFile: null,
        mediaPreview: null,
        scheduledDate: formattedDate,
        scheduledTime: strategyData.timeSlot,
        status: 'draft',
        isSelected: false
      });
    } else {
      // Multiple day scheduling with end date
      while (dayCount < maxDays && rowCount < 50) { // Limit to 50 rows max
        // Stop if we have an end date and current date exceeds it
        if (endDate && currentDate > endDate) {
          break;
        }

        // Stop if beyond 75 days from now
        const maxAllowedDate = new Date(Date.now() + 75 * 24 * 60 * 60 * 1000);
        if (currentDate > maxAllowedDate) {
          break;
        }

        // Apply frequency logic
        let shouldInclude = false;
        switch (strategyData.frequency) {
          case 'daily':
            shouldInclude = true;
            break;
          case 'weekly':
            // Check if it's the same day of the week as start date
            shouldInclude = currentDate.getUTCDay() === startDate.getUTCDay();
            break;
          case 'monthly':
            // Check if it's the same day of the month as start date
            shouldInclude = currentDate.getUTCDate() === startDate.getUTCDate();
            break;
          case 'custom':
            // For custom cron, include every day for now
            shouldInclude = true;
            break;
          default:
            shouldInclude = true;
        }

        if (shouldInclude) {
          // Format date consistently in YYYY-MM-DD format using UTC
          const formattedDate = currentDate.getUTCFullYear() + '-' +
            String(currentDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
            String(currentDate.getUTCDate()).padStart(2, '0');

          rows.push({
            id: `row-${rowCount}`,
            caption: '',
            mediaFile: null,
            mediaPreview: null,
            scheduledDate: formattedDate,
            scheduledTime: strategyData.timeSlot,
            status: 'draft',
            isSelected: false
          });
          rowCount++;
        }

        // Move to next day in UTC
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        dayCount++;
      }
    }

    setComposerRows(rows);
  }, [strategyData.startDate, strategyData.endDate, strategyData.frequency, strategyData.timeSlot]);

  // Initialize composer with default rows
  useEffect(() => {
    if (strategyData.startDate && strategyData.frequency) {
      generateInitialRows();
    }
  }, [strategyData.startDate, strategyData.endDate, strategyData.frequency, strategyData.timeSlot, generateInitialRows]);

  // Convert default time slot to IST on component mount
  useEffect(() => {
    // Convert the default UTC time to IST when component mounts
    if (strategyData.timeSlot) {
      const istTime = utcToIstTime(strategyData.timeSlot);
      setStrategyData(prev => ({ ...prev, timeSlot: istTime }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load scheduled posts
  const loadScheduledPosts = useCallback(async () => {
    setLoadingScheduledPosts(true);
    try {
      const response = await apiClient.getBulkComposerContent(selectedPage?.internalId);
      if (response && response.data) {
        setScheduledPosts(response.data);
      }
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
      alert('Failed to load scheduled posts. Please try again.');
    } finally {
      setLoadingScheduledPosts(false);
    }
  }, [selectedPage?.internalId]);

  // Load scheduled posts when component mounts or when page is selected
  useEffect(() => {
    if (selectedPage && selectedPage.internalId) {
      loadScheduledPosts();
    }
  }, [selectedPage?.internalId, loadScheduledPosts, selectedPage]);

  // After fetching scheduledPosts, add a debug log
  useEffect(() => {
    if (!loadingScheduledPosts && scheduledPosts.length > 0) {
      console.log('[BulkComposer] Raw scheduledPosts:', scheduledPosts);
    }
  }, [loadingScheduledPosts, scheduledPosts]);

  // After grouping batches, add a debug log
  useEffect(() => {
    console.log('[BulkComposer] Grouped batch keys:', sortedBatchKeys);
    console.log('[BulkComposer] Grouped batches:', groupedBatches);
  }, [sortedBatchKeys, groupedBatches]);

  // Auto-expand today's schedule and recent schedules
  useEffect(() => {
    if (scheduledPosts.length > 0 && !initialAutoExpandDone.current) {
      const today = new Date().toISOString().split('T')[0];
      const recentDates = sortedBatchKeys.slice(0, 3);
      if (groupedBatches[today]) {
        setExpandedSchedule(today);
      } else if (recentDates.length > 0) {
        setExpandedSchedule(recentDates[0]);
      } else {
        setExpandedSchedule(null);
      }
      initialAutoExpandDone.current = true;
    }
  }, [scheduledPosts.length, sortedBatchKeys, groupedBatches]);

  // Add this useEffect after the pagination logic:
  useEffect(() => { setSchedulePage(1); }, [scheduleSort, totalPages]);

  const handleStrategyChange = useCallback((field, value) => {
    setStrategyData(prev => {
      const newData = { ...prev, [field]: value };
      return newData;
    });

    // If prompt template is selected, apply it to all rows
    if (field === 'promptTemplate' && value) {
      setComposerRows(prev =>
        prev.map(row => ({
          ...row,
          caption: value
        }))
      );
    }

    // Validate end date is not the same as start date (only if end date is provided)
    if (field === 'endDate' && value && value === strategyData.startDate) {
      alert('End date cannot be the same as start date. Please select a different end date or leave it empty.');
      return;
    }

    // If start date is changed and end date is before it, clear end date
    if (field === 'startDate' && strategyData.endDate && value > strategyData.endDate) {
      setStrategyData(prev => ({ ...prev, endDate: '' }));
    }
  }, [strategyData.startDate, strategyData.endDate]);

  const handleRowSelect = (rowId) => {
    setSelectedRows(prev => {
      if (prev.includes(rowId)) {
        return prev.filter(id => id !== rowId);
      } else {
        return [...prev, rowId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedRows.length === composerRows.length) {
      setSelectedRows([]);
    } else {
      setSelectedRows(composerRows.map(row => row.id));
    }
  };

  const handleCellEdit = (rowId, field, value) => {
    setComposerRows(prev =>
      prev.map(row => {
        if (row.id === rowId) {
          const updatedRow = { ...row, [field]: value };
          // If caption is being edited and has content, set status to ready
          if (field === 'caption' && value.trim()) {
            updatedRow.status = 'ready';
          }
          return updatedRow;
        }
        return row;
      })
    );
  };

  const handleMediaUpload = (rowId, event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setComposerRows(prev =>
          prev.map(row =>
            row.id === rowId ? {
              ...row,
              mediaFile: file,
              mediaPreview: e.target.result
            } : row
          )
        );
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateMedia = async (rowId) => {
    try {
      // Get the row to use its caption as image prompt
      const row = composerRows.find(r => r.id === rowId);
      if (!row) {
        alert('Row not found.');
        return;
      }

      // Use the caption as the image prompt
      const imagePrompt = row.caption.trim();
      if (!imagePrompt) {
        alert('Please add a caption first to generate an image.');
        return;
      }

      // Generate image using Stability AI with the caption as prompt
      const response = await apiClient.generateFacebookImage(imagePrompt, 'feed');

      if (response.success && response.data && response.data.image_url) {
        console.log(`Successfully generated image for row ${rowId}:`, response.data.image_url);
        setComposerRows(prev => {
          const updatedRows = prev.map(r =>
            r.id === rowId ? {
              ...r,
              mediaFile: null, // No file object for generated images
              mediaPreview: response.data.image_url,
              mediaGenerated: true,
              status: r.status === 'ready' ? 'ready' : 'draft' // Keep status as ready if it was ready
            } : r
          );
          console.log('Updated rows after image generation:', updatedRows);
          console.log('Updated row:', updatedRows.find(r => r.id === rowId));
          return updatedRows;
        });
      } else {
        console.log(`Failed to generate image for row ${rowId}:`, response);
        alert('Failed to generate image. Please try again.');
      }
    } catch (error) {
      console.error('Error generating media:', error);
      alert('Failed to generate image. Please try again.');
    }
  };

  const handleGenerateAllCaptions = async () => {
    console.log('=== Starting Generate Captions for Selected Rows ===');
    console.log('Strategy Data:', strategyData);
    console.log('Selected Rows:', selectedRows);

    if (selectedRows.length === 0) {
      alert('Please select at least one row to generate captions for.');
      return;
    }

    // Check if we have a strategy template selected
    if (!strategyData.promptTemplate) {
      alert('Please select a strategy template first.');
      return;
    }

    try {
      // Get only the selected rows
      const selectedComposerRows = composerRows.filter(row => selectedRows.includes(row.id));

      // Create contexts for each selected row (using dates as context)
      const contexts = selectedComposerRows.map(row => {
        const date = new Date(row.scheduledDate);
        return `Post for ${date.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        })}`;
      });

      console.log('Generated contexts for selected rows:', contexts);

      let response;

      if (strategyData.promptTemplate === 'custom') {
        console.log('Using custom strategy template');
        // Use custom strategy template
        if (!strategyData.customStrategyTemplate.trim()) {
          alert('Please enter a custom strategy template first.');
          return;
        }

        console.log('Calling generateBulkCaptions with:', {
          customStrategy: strategyData.customStrategyTemplate,
          contexts: contexts,
          maxLength: 2000
        });

        response = await apiClient.generateFacebookBulkCaptions(
          strategyData.customStrategyTemplate,
          contexts,
          2000
        );
      } else {
        console.log('Using predefined strategy template');
        // Use predefined strategy template
        const selectedTemplate = promptTemplates.find(t => t.prompt === strategyData.promptTemplate);
        console.log('Selected template:', selectedTemplate);

        if (!selectedTemplate) {
          alert('Invalid strategy template selected.');
          return;
        }

        // Generate captions using the predefined template for selected rows only
        const captions = [];
        for (let i = 0; i < contexts.length; i++) {
          try {
            console.log(`Generating caption ${i + 1}/${contexts.length} for context:`, contexts[i]);
            const context = contexts[i];
            const captionResponse = await apiClient.generateFacebookCaptionWithStrategy(
              selectedTemplate.prompt,
              context,
              2000
            );

            console.log(`Caption ${i + 1} response:`, captionResponse);

            if (captionResponse.success) {
              captions.push({
                content: captionResponse.content,
                context: context,
                success: true
              });
            } else {
              captions.push({
                content: `Failed to generate caption for: ${context}`,
                context: context,
                success: false,
                error: captionResponse.error || 'Unknown error'
              });
            }
          } catch (error) {
            console.error(`Error generating caption for context ${contexts[i]}:`, error);
            captions.push({
              content: `Failed to generate caption for: ${contexts[i]}`,
              context: contexts[i],
              success: false,
              error: error.message
            });
          }
        }

        response = {
          success: true,
          captions: captions,
          total_generated: captions.filter(c => c.success).length
        };
      }

      console.log('Final response:', response);

      if (response.success && response.captions) {
        // Update only selected rows with generated captions
        setComposerRows(prev =>
          prev.map(row => {
            if (selectedRows.includes(row.id)) {
              // Find the corresponding caption for this selected row
              const selectedIndex = selectedComposerRows.findIndex(selectedRow => selectedRow.id === row.id);
              const generatedCaption = response.captions[selectedIndex];
              if (generatedCaption && generatedCaption.success) {
                return {
                  ...row,
                  caption: generatedCaption.content,
                  status: 'ready' // Update status to ready
                };
              }
            }
            return row;
          })
        );

        alert(`Successfully generated ${response.total_generated} captions for selected rows!`);
      } else {
        alert('Failed to generate captions. Please try again.');
      }
    } catch (error) {
      console.error('Error generating captions:', error);
      alert('Failed to generate captions. Please try again.');
    }
  };

  // Generate images for all selected rows
  const handleGenerateAllImages = async () => {
    if (selectedRows.length === 0) {
      alert('Please select at least one row to generate images.');
      return;
    }

    try {
      const selectedComposerRows = composerRows.filter(row => selectedRows.includes(row.id));

      for (let i = 0; i < selectedComposerRows.length; i++) {
        const row = selectedComposerRows[i];

        if (!row.caption || !row.caption.trim()) {
          console.log(`Skipping image generation for row ${row.id} - no caption available`);
          continue;
        }

        console.log(`Generating image for row ${row.id} with caption: ${row.caption}`);

        // Use the caption as the image prompt
        const imagePrompt = row.caption.trim();

        // Generate image using Stability AI with the caption as prompt
        const response = await apiClient.generateFacebookImage(imagePrompt, 'feed');

        if (response.success && response.data && response.data.image_url) {
          console.log(`Successfully generated image for row ${row.id}:`, response.data.image_url);
          setComposerRows(prev => {
            const updatedRows = prev.map(r =>
              r.id === row.id ? {
                ...r,
                mediaFile: null, // No file object for generated images
                mediaPreview: response.data.image_url,
                mediaGenerated: true,
                status: r.status === 'ready' ? 'ready' : 'draft' // Keep status as ready if it was ready
              } : r
            );
            console.log('Updated rows:', updatedRows);
            console.log('Row after update:', updatedRows.find(r => r.id === row.id));
            return updatedRows;
          });
        } else {
          console.log(`Failed to generate image for row ${row.id}:`, response);
        }
      }

      alert('Image generation completed!');
    } catch (error) {
      console.error('Error generating images:', error);
      alert('Failed to generate images. Please try again.');
    }
  };

  const handleExpandCaption = (rowId) => {
    const row = composerRows.find(r => r.id === rowId);
    if (row) {
      setExpandedCaption({
        rowId,
        caption: row.caption,
        scheduledDate: row.scheduledDate,
        scheduledTime: row.scheduledTime
      });
    }
  };

  const handleViewMedia = (rowId) => {
    const row = composerRows.find(r => r.id === rowId);
    if (row && row.mediaPreview) {
      setMediaPreviewModal({
        rowId,
        mediaUrl: row.mediaPreview,
        mediaType: (row.mediaFile?.type?.startsWith('image/') || (row.mediaPreview && !row.mediaFile)) ? 'image' : 'video',
        caption: row.caption
      });
    }
  };

  const handleSaveExpandedCaption = (newCaption) => {
    if (expandedCaption) {
      setComposerRows(prev =>
        prev.map(row =>
          row.id === expandedCaption.rowId ? {
            ...row,
            caption: newCaption
          } : row
        )
      );
      setExpandedCaption(null);
    }
  };

  const handleBulkDelete = () => {
    setComposerRows(prev => prev.filter(row => !selectedRows.includes(row.id)));
    setSelectedRows([]);
  };



  const handleDragStart = (rowId) => {
    setDragStartRow(rowId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (targetRowId) => {
    if (dragStartRow && dragStartRow !== targetRowId) {
      const rows = [...composerRows];
      const sourceIndex = rows.findIndex(row => row.id === dragStartRow);
      const targetIndex = rows.findIndex(row => row.id === targetRowId);

      const [movedRow] = rows.splice(sourceIndex, 1);
      rows.splice(targetIndex, 0, movedRow);

      setComposerRows(rows);
    }
    setDragStartRow(null);
  };

  const handleScheduleAll = async () => {
    // More robust checking for selectedPage and its database ID
    if (!selectedPage || !selectedPage.internalId || composerRows.length === 0) {
      console.log('Selected Page Debug:', selectedPage);

      if (!selectedPage) {
        alert('Please select a page first before scheduling posts.');
        return;
      }

      if (!selectedPage.internalId) {
        // Try to automatically sync the page first
        const shouldRetry = await new Promise((resolve) => {
          const confirmed = window.confirm(
            `The selected page "${selectedPage.name}" is not properly synced with the database.\n\n` +
            `Would you like to try syncing it automatically?\n\n` +
            `Click "OK" to try syncing, or "Cancel" to abort scheduling.`
          );
          resolve(confirmed);
        });

        if (shouldRetry) {
          const syncSuccess = await checkPageSync();
          if (!syncSuccess) {
            const manualRetry = window.confirm(
              `Automatic sync failed. This usually happens when:\n\n` +
              `1. The page was recently connected\n` +
              `2. Facebook permissions need to be refreshed\n\n` +
              `Would you like to:\n` +
              `• Click "OK" to disconnect and reconnect Facebook\n` +
              `• Click "Cancel" to try manual sync later`
            );

            if (manualRetry) {
              alert('Please use the "Disconnect Facebook" button in the main interface, then reconnect Facebook and try again.');
            }
            return;
          }
          // If sync was successful, continue with scheduling
        } else {
          return;
        }
      }

      if (composerRows.length === 0) {
        alert('No posts to schedule. Please create some posts first.');
        return;
      }
    }

    // Check authentication
    if (!isAuthenticated) {
      alert('Please log in to schedule posts.');
      return;
    }

    // Filter only ready posts
    const readyPosts = composerRows.filter(row => row.status === 'ready' && row.caption.trim());

    console.log('=== Bulk Schedule Debug Info ===');
    console.log('Selected Page:', selectedPage);
    console.log('Using Database ID (internalId):', selectedPage.internalId);
    console.log('Facebook Page ID (for reference):', selectedPage.id);
    console.log('Total Composer Rows:', composerRows.length);
    console.log('Ready Posts:', readyPosts.length);
    console.log('Ready Posts Data:', readyPosts);

    if (readyPosts.length === 0) {
      alert('No posts are ready to be scheduled. Please generate captions first.');
      return;
    }

    setIsScheduling(true);
    setScheduleProgress(0);

    try {
      // Use the database ID (internalId) not the Facebook page ID
      const pageId = selectedPage.internalId;

      console.log('Using database social_account_id:', pageId);

      // Prepare bulk data with media files
      const postsWithMedia = await Promise.all(
        readyPosts.map(async (row) => {
          let mediaFile = null;

          // Handle uploaded files
          if (row.mediaFile) {
            try {
              mediaFile = await fileToBase64(row.mediaFile);
              console.log('Converted uploaded file to base64 for row:', row.id);
            } catch (error) {
              console.error('Error converting uploaded file to base64:', error);
            }
          }
          // Handle generated images
          else if (row.mediaPreview && !row.mediaFile) {
            // For generated images, we need to fetch the image and convert to base64
            try {
              console.log('Fetching generated image for row:', row.id, 'URL:', row.mediaPreview);
              const response = await fetch(row.mediaPreview);
              if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
              }
              const blob = await response.blob();
              mediaFile = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  if (reader.result) {
                    resolve(reader.result);
                  } else {
                    reject(new Error('Failed to convert image to base64'));
                  }
                };
                reader.onerror = () => reject(new Error('FileReader error'));
                reader.readAsDataURL(blob);
              });
              console.log('Converted generated image to base64 for row:', row.id);
            } catch (error) {
              console.error('Error converting generated image to base64:', error);
              // Don't fail the entire post if image conversion fails
              mediaFile = null;
            }
          }

          // For Instagram bulk schedule, send scheduled_time in IST (as selected in UI)
          const postData = {
            caption: row.caption,
            scheduled_date: row.scheduledDate,
            scheduled_time: row.scheduledTime, // Send IST time directly
            media_file: mediaFile,
            media_filename: row.mediaFile ? row.mediaFile.name : (row.mediaPreview ? 'generated_image.jpg' : null)
          };

          // Validate that the scheduled datetime is in the future
          const scheduledDateTime = new Date(`${postData.scheduled_date}T${postData.scheduled_time}:00Z`);
          const now = new Date();
          if (scheduledDateTime <= now) {
            console.warn(`Post for row ${row.id} is scheduled in the past:`, scheduledDateTime);
            // You might want to skip this post or show a warning
          }

          console.log('Prepared post data for row:', row.id, {
            caption: postData.caption?.substring(0, 50) + '...',
            scheduled_date: postData.scheduled_date,
            scheduled_time: postData.scheduled_time,
            scheduled_datetime_utc: scheduledDateTime.toISOString(),
            has_media: !!postData.media_file,
            media_filename: postData.media_filename
          });

          return postData;
        })
      );

      const requestPayload = {
        social_account_id: pageId,
        posts: postsWithMedia
      };

      console.log('=== Sending to Backend ===');
      console.log('Database Page ID (social_account_id):', pageId);
      console.log('Number of posts:', postsWithMedia.length);
      console.log('Request payload structure:', {
        social_account_id: requestPayload.social_account_id,
        posts_count: requestPayload.posts.length,
        first_post_sample: requestPayload.posts[0] ? {
          caption: requestPayload.posts[0].caption?.substring(0, 50) + '...',
          scheduled_date: requestPayload.posts[0].scheduled_date,
          scheduled_time: requestPayload.posts[0].scheduled_time,
          has_media: !!requestPayload.posts[0].media_file,
          media_filename: requestPayload.posts[0].media_filename
        } : 'No posts'
      });

      // Additional debugging for timezone handling
      console.log('=== Timezone Debug Info ===');
      console.log('Current UTC time:', new Date().toISOString());
      console.log('Current local time:', new Date().toString());
      console.log('Sample post scheduled datetime:', postsWithMedia[0] ?
        new Date(`${postsWithMedia[0].scheduled_date}T${postsWithMedia[0].scheduled_time}:00Z`).toISOString() : 'No posts');

      // Send the bulk schedule request
      const response = await apiClient.bulkSchedulePosts(requestPayload);

      console.log('=== Backend Response ===');
      console.log('Full response:', response);

      // Update status of scheduled posts
      setComposerRows(prev =>
        prev.map(row => {
          if (readyPosts.some(readyPost => readyPost.id === row.id)) {
            return { ...row, status: 'scheduled' };
          }
          return row;
        })
      );

      setScheduleProgress(100);

      // Show success message with details
      const successCount = Array.isArray(response.results) ? response.results.filter(r => r.success).length : readyPosts.length;
      const failedCount = Array.isArray(response.results) ? response.results.filter(r => !r.success).length : 0;

      console.log('=== Results Summary ===');
      console.log('Success count:', successCount);
      console.log('Failed count:', failedCount);

      if (response.results && Array.isArray(response.results)) {
        console.log('Detailed results:', response.results);
        response.results.forEach((result, index) => {
          if (!result.success) {
            console.error(`Post ${index + 1} failed:`, result.error || result.message || 'Unknown error');
          }
        });
      }

      if (failedCount > 0) {
        alert(`Scheduled ${successCount} posts successfully. ${failedCount} posts failed. Check console for details.`);
      } else {
        alert(`Successfully scheduled ${successCount} posts!`);

        // Add success notification for bulk scheduling
        if (successCount > 0) {
          addNotification({
            type: 'success',
            platform: 'facebook',
            strategyName: strategyData.promptTemplate || 'Bulk Schedule',
            message: `Successfully scheduled ${successCount} Facebook posts! You'll receive alerts 10 minutes before each post goes live.`
          });
        }
      }

      // Reload scheduled posts to show the newly scheduled content
      await loadScheduledPosts();

      // Don't auto-close the modal anymore - let user choose when to close
      // onClose();
    } catch (error) {
      console.error('=== Frontend Error ===');
      console.error('Error scheduling posts:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });

      // Provide better error messages based on error type
      if (error.message?.includes('social_account_id') || error.message?.includes('not found')) {
        const retrySync = window.confirm(
          `Page synchronization error detected.\n\n` +
          `Error: ${error.message}\n\n` +
          `Would you like to try syncing the page again?`
        );

        if (retrySync) {
          await checkPageSync();
        }
      } else {
        alert(`Error scheduling posts: ${error.message || 'Please try again.'}`);
      }
    } finally {
      setIsScheduling(false);
      setScheduleProgress(0);
    }
  };

  const handleRemoveMedia = (rowId) => {
    setComposerRows(prev =>
      prev.map(row =>
        row.id === rowId ? {
          ...row,
          mediaFile: null,
          mediaPreview: null,
          mediaGenerated: false // Reset generated status
        } : row
      )
    );
  };

  // Calendar helper functions
  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const generateCalendarDays = (year, month) => {
    const daysInMonth = getDaysInMonth(year, month);
    const firstDayOfMonth = getFirstDayOfMonth(year, month);
    const days = [];

    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push({ day: null, date: null });
    }

    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      days.push({ day: i, date: date });
    }

    return days;
  };

  const getPostsForDate = (date) => {
    // Format date consistently to avoid timezone issues
    const dateString = date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
    const postsForDate = composerRows.filter(row => row.scheduledDate === dateString);
    if (postsForDate.length > 0) {
      console.log('Found posts for date:', dateString, 'Count:', postsForDate.length);
    }
    return postsForDate;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'published':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        );
      case 'failed':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        );
      case 'scheduled':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12,6 12,12 16,14" />
          </svg>
        );
      case 'ready':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
      default:
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        );
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'published':
        return 'status-published';
      case 'failed':
        return 'status-failed';
      case 'scheduled':
        return 'status-scheduled';
      case 'ready':
        return 'status-ready';
      default:
        return 'status-draft';
    }
  };

  // Handle schedule expansion
  const toggleScheduleExpansion = (dateKey) => {
    setExpandedSchedule(prev => {
      if (prev === dateKey) {
        return null;
      }
      return dateKey;
    });
  };

  // Handle post editing
  const startEditingPost = (post) => {
    setEditingPost({
      id: post.id,
      caption: post.caption,
      original: post
    });
  };

  const savePostEdit = async () => {
    if (!editingPost) return;

    try {
      // Call API to update post caption
      await apiClient.updateBulkComposerPost(editingPost.id, editingPost.caption);

      // Update local state
      setScheduledPosts(prev =>
        prev.map(post =>
          post.id === editingPost.id
            ? { ...post, caption: editingPost.caption }
            : post
        )
      );

      setEditingPost(null);
      alert('Post updated successfully!');
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Failed to update post. Please try again.');
    }
  };

  const cancelPostEdit = () => {
    setEditingPost(null);
  };

  const cancelScheduledPost = async (postId, postCaption) => {
    if (!window.confirm(`Are you sure you want to cancel this scheduled post?\n\n"${postCaption.substring(0, 100)}..."`)) {
      return;
    }

    try {
      await apiClient.cancelBulkComposerPost(postId);

      // Remove from local state
      setScheduledPosts(prev => prev.filter(post => post.id !== postId));

      alert('Scheduled post canceled successfully!');
    } catch (error) {
      console.error('Error canceling post:', error);
      alert('Failed to cancel post. Please try again.');
    }
  };

  // Add page synchronization checking function
  const checkPageSync = useCallback(async () => {
    if (!selectedPage) return false;

    setIsCheckingPageSync(true);
    setPageSyncStatus('Checking page synchronization...');

    try {
      const socialAccounts = await apiClient.getSocialAccounts();
      const facebookAccounts = socialAccounts.filter(acc =>
        acc.platform === 'facebook' && acc.is_connected
      );

      const matchingAccount = facebookAccounts.find(acc =>
        acc.platform_user_id === selectedPage.id
      );

      if (matchingAccount) {
        // Update the selected page with internal ID
        if (onPageChange) {
          const updatedPage = {
            ...selectedPage,
            internalId: matchingAccount.id
          };
          onPageChange(updatedPage);
        }
        setPageSyncStatus('✓ Page is synchronized');
        return true;
      } else {
        setPageSyncStatus('⚠ Page is not synchronized with database');
        return false;
      }
    } catch (error) {
      console.error('Error checking page sync:', error);
      setPageSyncStatus('✗ Failed to check page synchronization');
      return false;
    } finally {
      setIsCheckingPageSync(false);
    }
  }, [selectedPage, onPageChange]);

  // Handle page selection change
  // eslint-disable-next-line no-unused-vars
  const handlePageSelect = (pageId) => {
    if (onPageChange && availablePages) {
      const newPage = availablePages.find(p => p.id === pageId);
      if (newPage) {
        onPageChange(newPage);
        // Reset composer state when page changes
        setComposerRows([]);
        setSelectedRows([]);
        setScheduledPosts([]);
        setPageSyncStatus('');
      }
    }
  };

  // Auto-check page sync when selectedPage changes (moved here after checkPageSync definition)
  useEffect(() => {
    if (selectedPage && !selectedPage.internalId) {
      // Delay the sync check to allow for any ongoing backend sync
      const timer = setTimeout(() => {
        checkPageSync();
      }, 1000);

      return () => clearTimeout(timer);
    } else if (selectedPage && selectedPage.internalId) {
      setPageSyncStatus('✓ Page is synchronized');
    }
  }, [selectedPage, checkPageSync]);

  return (
    <div className="bulk-composer-panel">
      <div className="bulk-composer-header">
        <div className="header-content">
          <h2>Bulk Composer</h2>
          <p className="header-subtitle">Create and schedule multiple social media posts efficiently</p>
        </div>

        {!isAuthenticated && (
          <div className="auth-warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Please log in to schedule posts</span>
          </div>
        )}
      </div>
      <div className="bulk-composer-scrollable-content">
        {/* Strategy and Calendar Combined */}
        <div className="strategy-calendar-section">
          <div className="strategy-step">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
              Step 1: Strategy & Schedule
            </h3>
            <div className="strategy-form">
              <div className="form-group">
                <label>Strategy Template</label>
                <select
                  value={strategyData.promptTemplate}
                  onChange={(e) => handleStrategyChange('promptTemplate', e.target.value)}
                  className="form-select"
                >
                  <option value="">Select a template...</option>
                  {promptTemplates.map(template => (
                    <option key={template.id} value={template.prompt}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>

              {strategyData.promptTemplate === 'custom' && (
                <div className="form-group">
                  <label>Custom Strategy Template</label>
                  <textarea
                    value={strategyData.customStrategyTemplate}
                    onChange={(e) => handleStrategyChange('customStrategyTemplate', e.target.value)}
                    placeholder="Enter your custom strategy template. This will be used by AI to generate captions that follow your specific style and approach..."
                    className="form-textarea"
                    rows="3"
                  />
                  <small className="form-help">
                    Describe your content strategy, tone, style, and any specific requirements for your posts.
                  </small>
                </div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={strategyData.startDate}
                    onChange={(e) => handleStrategyChange('startDate', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>End Date (Optional)</label>
                  <div className="end-date-container">
                    <input
                      type="date"
                      value={strategyData.endDate}
                      onChange={(e) => handleStrategyChange('endDate', e.target.value)}
                      className="form-input"
                      min={strategyData.startDate}
                      disabled={!strategyData.startDate}
                    />
                    <button
                      type="button"
                      onClick={() => handleStrategyChange('endDate', '')}
                      className="btn btn-secondary btn-small"
                      disabled={!strategyData.endDate}
                      title="Clear end date (single day schedule)"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Clear
                    </button>
                  </div>
                  <small className="form-help">
                    Leave empty for single day schedule
                  </small>
                </div>

                {/* Time Slot should be just below End Date */}
                <div className="form-group">
                  <label>Time Slot (IST - Indian Standard Time)</label>
                  <input
                    type="time"
                    value={strategyData.timeSlot}
                    onChange={(e) => handleStrategyChange('timeSlot', e.target.value)}
                    className="form-input"
                  />
                  <small className="form-help">
                    All times are in IST (UTC+5:30).
                  </small>
                </div>
              </div>

              {strategyData.frequency === 'custom' && (
                <div className="form-group">
                  <label>Custom Cron Expression</label>
                  <input
                    type="text"
                    value={strategyData.customCron}
                    onChange={(e) => handleStrategyChange('customCron', e.target.value)}
                    placeholder="0 9 * * * (daily at 9 AM)"
                    className="form-input"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Calendar Preview */}
          <div className="calendar-preview-section">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              Calendar Preview
            </h3>
            <div className="calendar-container">
              <div className="calendar-header">
                <button
                  onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                  className="btn btn-secondary btn-small"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15,18 9,12 15,6" />
                  </svg>
                </button>
                <h4>{currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h4>
                <button
                  onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
                  className="btn btn-secondary btn-small"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9,18 15,12 9,6" />
                  </svg>
                </button>
              </div>
              <div className="calendar-grid">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="calendar-day-header">{day}</div>
                ))}
                {generateCalendarDays(currentMonth.getFullYear(), currentMonth.getMonth()).map((day, index) => (
                  <div
                    key={index}
                    className={`calendar-day ${day.date ? 'clickable' : ''} ${day.date && getPostsForDate(day.date).length > 0 ? 'has-posts' : ''}`}
                  >
                    <span className="day-number">{day.day}</span>
                    {day.date && getPostsForDate(day.date).length > 0 && (
                      <div className="post-indicators">
                        {getPostsForDate(day.date).map((post, postIndex) => (
                          <div
                            key={postIndex}
                            className="post-dot"
                            title={`${post.scheduledTime} - ${post.caption.substring(0, 30)}...`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {/* Frequency moved here for cleaner UI */}
            <div className="form-row calendar-options-row">
              <div className="form-group">
                <label>Frequency</label>
                <select
                  value={strategyData.frequency}
                  onChange={(e) => handleStrategyChange('frequency', e.target.value)}
                  className="form-select"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom Cron</option>
                </select>
              </div>
            </div>
            {strategyData.frequency === 'custom' && (
              <div className="form-group">
                <label>Custom Cron Expression</label>
                <input
                  type="text"
                  value={strategyData.customCron}
                  onChange={(e) => handleStrategyChange('customCron', e.target.value)}
                  placeholder="0 9 * * * (daily at 9 AM)"
                  className="form-input"
                />
              </div>
            )}
          </div>
        </div>

        {/* Composer Grid */}
        <div className="composer-grid-section">
          <div className="composer-header">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="9" y2="15" />
                <line x1="15" y1="9" x2="15" y2="15" />
                <line x1="9" y1="12" x2="15" y2="12" />
              </svg>
              Step 2: Content Grid
            </h3>
            <div className="composer-controls">
              <button
                onClick={() => {
                  const newRow = {
                    id: `row-${Date.now()}-${Math.random()}`,
                    caption: '',
                    mediaFile: null,
                    mediaPreview: null,
                    scheduledDate: new Date().toISOString().split('T')[0],
                    scheduledTime: strategyData.timeSlot,
                    status: 'draft',
                    isSelected: false
                  };
                  setComposerRows(prev => [...prev, newRow]);
                }}
                className="btn btn-primary btn-small"
              >
                <MdAdd size={16} />
              </button>
              <button
                onClick={handleSelectAll}
                className="btn btn-secondary btn-small"
              >
                {selectedRows.length === composerRows.length ? <MdSelectAll size={16} /> : <MdSelectAll size={16} />}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedRows.length === 0}
                className="btn btn-danger btn-small"
              >
                <MdDelete size={16} />
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGenerateAllCaptions}
                disabled={composerRows.length === 0 || selectedRows.length === 0}
              >
                Generate Captions
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleGenerateAllImages}
                disabled={composerRows.length === 0 || selectedRows.length === 0}
              >
                Generate Images
              </button>
            </div>
          </div>

          <div className="composer-grid-container">
            <div className="composer-grid" ref={gridRef}>
              <div className="grid-header grid-row">
                <div className="grid-cell header-cell"></div>
                <div className="grid-cell header-cell" title="Caption">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="9" y1="9" x2="15" y2="9" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                  <span className="header-label">Caption</span>
                </div>
                <div className="grid-cell header-cell" title="Media">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21,15 16,10 5,21" />
                  </svg>
                  <span className="header-label">Media</span>
                </div>
                <div className="grid-cell header-cell" title="Date">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span className="header-label">Date</span>
                </div>
                <div className="grid-cell header-cell" title="Time">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12,6 12,12 16,14" />
                  </svg>
                  <span className="header-label">Time</span>
                </div>
                <div className="grid-cell header-cell" title="Status">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                  <span className="header-label">Status</span>
                </div>
              </div>

              <div className="grid-body">
                {composerRows.map((row, index) => (
                  <div
                    key={row.id}
                    className={`grid-row ${row.isSelected ? 'selected' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(row.id)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(row.id)}
                  >
                    <div className="grid-cell">
                      <input
                        type="checkbox"
                        checked={selectedRows.includes(row.id)}
                        onChange={() => handleRowSelect(row.id)}
                      />
                    </div>

                    <div className="grid-cell caption-cell">
                      <div className="caption-container">
                        <textarea
                          value={row.caption}
                          onChange={(e) => handleCellEdit(row.id, 'caption', e.target.value)}
                          placeholder="Enter your post caption..."
                          className="caption-input"
                          rows="3"
                          style={{ resize: 'none' }}
                        />
                        <button
                          onClick={() => handleExpandCaption(row.id)}
                          className="expand-btn"
                          title="Expand caption"
                        >
                          <MdExpandMore size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="grid-cell media-cell">
                      <div className="media-options">
                        {!row.mediaPreview && !row.mediaFile ? (
                          <div className="media-option-group">
                            <input
                              type="file"
                              accept="image/*,video/*"
                              onChange={(e) => handleMediaUpload(row.id, e)}
                              className="media-input"
                              id={`media-upload-${row.id}`}
                            />
                            <label htmlFor={`media-upload-${row.id}`} className="media-option-btn upload-btn">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7,10 12,15 17,10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                              </svg>
                              Upload
                            </label>
                            <button
                              onClick={() => handleGenerateMedia(row.id)}
                              className="media-option-btn generate-btn"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                              Generate
                            </button>
                          </div>
                        ) : (
                          <div className="media-preview">
                            {(() => {
                              console.log(`Rendering media for row ${row.id}:`, {
                                mediaFile: row.mediaFile,
                                mediaPreview: row.mediaPreview,
                                mediaGenerated: row.mediaGenerated,
                                hasMediaPreview: !!row.mediaPreview,
                                hasMediaFile: !!row.mediaFile
                              });

                              // For generated images (no mediaFile, but has mediaPreview)
                              if (row.mediaPreview && !row.mediaFile) {
                                console.log(`Rendering generated image for row ${row.id}:`, row.mediaPreview);
                                return <img src={row.mediaPreview} alt="Generated Preview" />;
                              }

                              // For uploaded files
                              if (row.mediaFile?.type?.startsWith('image/')) {
                                console.log(`Rendering uploaded image for row ${row.id}:`, row.mediaPreview);
                                return <img src={row.mediaPreview} alt="Uploaded Preview" />;
                              }

                              // For videos
                              console.log(`Rendering video for row ${row.id}:`, row.mediaPreview);
                              return <video src={row.mediaPreview} controls />;
                            })()}
                            <button
                              onClick={() => handleViewMedia(row.id)}
                              className="view-media-btn"
                              title="View media"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRemoveMedia(row.id)}
                              className="remove-media-btn"
                              title="Remove media"
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid-cell date-cell">
                      <input
                        type="date"
                        value={row.scheduledDate}
                        onChange={(e) => handleCellEdit(row.id, 'scheduledDate', e.target.value)}
                        className="date-input"
                      />
                    </div>

                    <div className="grid-cell time-cell">
                      <input
                        type="time"
                        value={row.scheduledTime}
                        onChange={(e) => handleCellEdit(row.id, 'scheduledTime', e.target.value)}
                        className="time-input"
                        style={{ width: '90px' }}
                      />
                    </div>

                    <div className="grid-cell status-cell">
                      <span className={`status-badge ${getStatusClass(row.status)}`}>
                        {getStatusIcon(row.status)} {row.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Queue Confirmation */}
        <div className="queue-confirmation">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
            Step 3: Schedule & Publish
          </h3>
          <div className="confirmation-stats">
            <div className="stat-item">
              <span className="stat-label">Total Posts:</span>
              <span className="stat-value">{composerRows.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">With Captions:</span>
              <span className="stat-value">{composerRows.filter(row => row.caption.trim()).length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Ready to Schedule:</span>
              <span className="stat-value">{composerRows.filter(row => row.status === 'ready').length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">With Media:</span>
              <span className="stat-value">{composerRows.filter(row => row.mediaFile || row.mediaPreview).length}</span>
            </div>
          </div>

          {isScheduling && (
            <div className="schedule-progress">
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${scheduleProgress}%` }}
                />
              </div>
              <span className="progress-text">Scheduling posts... {Math.round(scheduleProgress)}%</span>
            </div>
          )}

          <div className="confirmation-actions">
            <button
              onClick={handleScheduleAll}
              disabled={isScheduling || composerRows.filter(row => row.status === 'ready').length === 0 || !isAuthenticated}
              className="btn btn-primary btn-large"
            >
              {isScheduling ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Scheduling...
                </>
              ) : !isAuthenticated ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10,17 15,12 10,7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Please Log In to Schedule
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12,6 12,12 16,14" />
                  </svg>
                  Schedule Ready Posts ({composerRows.filter(row => row.status === 'ready').length})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Scheduled Posts View */}
        <div className="scheduled-posts-section">
          <div className="scheduled-posts-header">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10,9 9,9 8,9" />
              </svg>
              Scheduled Posts
            </h3>
            <div className="scheduled-posts-controls">
              <button
                onClick={() => setShowScheduledPosts(!showScheduledPosts)}
                className="btn btn-secondary btn-small"
              >
                {showScheduledPosts ? 'Hide' : 'Show'} Scheduled Posts ({scheduledPosts.length})
              </button>
              <button
                onClick={loadScheduledPosts}
                disabled={loadingScheduledPosts}
                className="btn btn-secondary btn-small"
              >
                {loadingScheduledPosts ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M23 4v6h-6" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                )}
                Refresh
              </button>
            </div>
          </div>

          {showScheduledPosts && (
            <div className="scheduled-posts-container">
              {loadingScheduledPosts ? (
                <div className="loading-scheduled-posts">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 11-6.219-8.56" />
                  </svg>
                  Loading scheduled posts...
                </div>
              ) : pagedBatchKeys.length > 0 ? (
                <div className="scheduled-posts-list">
                  {pagedBatchKeys.length > 0 && (
                    <div className="schedule-pagination-controls">
                      <button onClick={() => setSchedulePage(p => Math.max(1, p - 1))} disabled={schedulePage === 1}>Prev</button>
                      <span>Page {schedulePage} of {totalPages}</span>
                      <button onClick={() => setSchedulePage(p => Math.min(totalPages, p + 1))} disabled={schedulePage === totalPages}>Next</button>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MdSort size={20} />
                        <select value={scheduleSort} onChange={e => { setScheduleSort(e.target.value); }}>
                          <option value="desc">Newest First</option>
                          <option value="asc">Oldest First</option>
                        </select>
                      </span>
                    </div>
                  )}
                  {pagedBatchKeys.map((batchKey, idx) => {
                    const batchPosts = groupedBatches[batchKey];
                    const isExpanded = expandedSchedule === batchKey;
                    // Get date range for summary
                    const dates = batchPosts.map(p => p.scheduled_date).sort();
                    const dateRange = dates.length > 1 ? `${dates[0]} - ${dates[dates.length - 1]}` : dates[0];
                    return (
                      <div key={batchKey} className={`scheduled-post-group${isExpanded ? ' expanded' : ''}`}>
                        <div className="schedule-group-header">
                          <div className="schedule-info">
                            <h4 className="schedule-date">
                              {dateRange}
                            </h4>
                            <div className="schedule-stats">
                              <span className="post-count">{batchPosts.length} scheduled</span>
                              <span className="status-breakdown">
                                {(() => {
                                  const statuses = batchPosts.reduce((acc, post) => {
                                    acc[post.status] = (acc[post.status] || 0) + 1;
                                    return acc;
                                  }, {});
                                  return Object.entries(statuses).map(([status, count]) => (
                                    <span key={status} className={`status-chip ${status.toLowerCase()}`}>{count} {status}</span>
                                  ));
                                })()}
                              </span>
                            </div>
                          </div>
                          <div className="expand-controls">
                            <button
                              onClick={() => toggleScheduleExpansion(batchKey)}
                              className={`expand-btn${isExpanded ? ' expanded' : ''}`}
                              title={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              <MdExpandMore size={16} />
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="schedule-content-grid">
                            <div className="content-grid-header">
                              <div className="grid-header-cell">Status</div>
                              <div className="grid-header-cell">Caption</div>
                              <div className="grid-header-cell">Time</div>
                              <div className="grid-header-cell">Media</div>
                              <div className="grid-header-cell">Actions</div>
                            </div>
                            {batchPosts
                              .sort((a, b) => a.scheduled_time.localeCompare(b.scheduled_time))
                              .map((post) => (
                                <div key={post.id} className="content-grid-row">
                                  <div className="grid-cell status-cell">
                                    <span className={`post-status-badge ${post.status.toLowerCase()}`}>{getStatusIcon(post.status)} {post.status}</span>
                                  </div>
                                  <div className="grid-cell caption-cell">
                                    {editingPost && editingPost.id === post.id ? (
                                      <textarea
                                        value={editingPost.caption}
                                        onChange={(e) => setEditingPost(prev => ({ ...prev, caption: e.target.value }))}
                                        className="inline-caption-editor"
                                        rows="4"
                                        placeholder="Enter your caption..."
                                      />
                                    ) : (
                                      <div className="caption-preview" onClick={() => post.status === 'scheduled' ? startEditingPost(post) : null} style={{ cursor: post.status === 'scheduled' ? 'pointer' : 'not-allowed', opacity: post.status === 'scheduled' ? 1 : 0.6 }}>
                                        {post.caption.length > 100 ? `${post.caption.substring(0, 100)}...` : post.caption}
                                      </div>
                                    )}
                                  </div>
                                  <div className="grid-cell time-cell">
                                    <span className="schedule-time">{post.scheduled_time}</span>
                                  </div>
                                  <div className="grid-cell media-cell">
                                    {post.media_file ? (
                                      post.media_file.startsWith('data:image') || post.media_file.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                        <img src={post.media_file} alt="Media" style={{ maxWidth: 60, maxHeight: 60, borderRadius: 6, border: '1px solid #eee' }} />
                                      ) : post.media_file.startsWith('data:video') || post.media_file.match(/\.(mp4|webm|ogg)$/i) ? (
                                        <video src={post.media_file} controls style={{ maxWidth: 80, maxHeight: 60, borderRadius: 6, border: '1px solid #eee' }} />
                                      ) : (
                                        <a href={post.media_file} target="_blank" rel="noopener noreferrer">View Media</a>
                                      )
                                    ) : (
                                      <span className="no-media">Text only</span>
                                    )}
                                  </div>
                                  <div className="grid-cell actions-cell">
                                    {editingPost && editingPost.id === post.id ? (
                                      <div className="edit-actions">
                                        <button onClick={savePostEdit} className="btn btn-success btn-small">
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                            <polyline points="17,21 17,13 7,13 7,21" />
                                            <polyline points="7,3 7,8 15,8" />
                                          </svg>
                                          <span>Save</span>
                                        </button>
                                        <button onClick={cancelPostEdit} className="btn btn-secondary btn-small">
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                          </svg>
                                          <span>Cancel</span>
                                        </button>
                                      </div>
                                    ) : (
                                      post.status === 'scheduled' && (
                                        <div className="post-actions">
                                          <button onClick={() => startEditingPost(post)} className="btn btn-primary btn-small" title="Edit caption">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                              <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                          </button>
                                          <button onClick={() => cancelScheduledPost(post.id, post.caption)} className="btn btn-danger btn-small" title="Cancel scheduled post">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                              <circle cx="12" cy="12" r="10" />
                                              <line x1="15" y1="9" x2="9" y2="15" />
                                              <line x1="9" y1="9" x2="15" y2="15" />
                                            </svg>
                                          </button>
                                        </div>
                                      )
                                    )}
                                  </div>
                                  {post.error_message && (
                                    <div className="grid-cell error-cell full-width">
                                      <div className="error-message">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                          <circle cx="12" cy="12" r="10" />
                                          <line x1="15" y1="9" x2="9" y2="15" />
                                          <line x1="9" y1="9" x2="15" y2="15" />
                                        </svg>
                                        {post.error_message}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="no-scheduled-posts">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12,6 12,12 16,14" />
                  </svg>
                  <p>No scheduled posts yet. Create and schedule some posts above!</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expanded Caption Modal */}
      {expandedCaption && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Edit Caption</h3>
              <button
                onClick={() => setExpandedCaption(null)}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="caption-info">
                <p><strong>Scheduled:</strong> {expandedCaption.scheduledDate} at {expandedCaption.scheduledTime}</p>
              </div>
              <textarea
                value={expandedCaption.caption}
                onChange={(e) => setExpandedCaption(prev => ({ ...prev, caption: e.target.value }))}
                className="expanded-caption-textarea"
                rows="10"
                placeholder="Enter your caption..."
              />
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setExpandedCaption(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveExpandedCaption(expandedCaption.caption)}
                className="btn btn-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Preview Modal */}
      {mediaPreviewModal && (
        <div className="modal-overlay">
          <div className="modal-content media-preview-modal">
            <div className="modal-header">
              <h3>Media Preview</h3>
              <button
                onClick={() => setMediaPreviewModal(null)}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {mediaPreviewModal.mediaType === 'image' ? (
                <img
                  src={mediaPreviewModal.mediaUrl}
                  alt="Media preview"
                  className="modal-media"
                />
              ) : (
                <video
                  src={mediaPreviewModal.mediaUrl}
                  controls
                  className="modal-media"
                />
              )}
              {mediaPreviewModal.caption && (
                <div className="modal-caption">
                  <h4>Caption:</h4>
                  <p>{mediaPreviewModal.caption}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setMediaPreviewModal(null)}
                className="btn btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BulkComposer; 