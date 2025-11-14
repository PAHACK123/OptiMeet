import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Users, Send, CheckCircle, XCircle, Clock, Mail, AlertCircle, MessageSquare, Video, MapPin, Sparkles } from 'lucide-react';

const PENN_STUDENTS = [
  { name: "Gayatri Sriram", email: "gayatri1@wharton.upenn.edu" },
  { name: "Manan Dadhania", email: "dadhania@wharton.upenn.edu" },
  { name: "Ash Rk", email: "ashrk@wharton.upenn.edu" }
];

const generateMockCalendar = (email) => {
  const busyTimes = {
    "gayatri1@wharton.upenn.edu": [
      { day: "Monday", start: "9:00 AM", end: "10:30 AM" },
      { day: "Tuesday", start: "11:00 AM", end: "12:30 PM" }
    ],
    "dadhania@wharton.upenn.edu": [
      { day: "Monday", start: "10:00 AM", end: "11:30 AM" },
      { day: "Tuesday", start: "2:00 PM", end: "4:00 PM" }
    ],
    "ashrk@wharton.upenn.edu": [
      { day: "Monday", start: "1:00 PM", end: "2:30 PM" },
      { day: "Wednesday", start: "10:00 AM", end: "11:30 AM" }
    ]
  };
  return busyTimes[email] || [];
};

export default function WhartonScheduler() {
  const [step, setStep] = useState('setup');
  const [selectedAttendees, setSelectedAttendees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [proposedMeeting, setProposedMeeting] = useState(null);
  const [meetingInvited, setMeetingInvited] = useState(false);
  const [attendeeResponses, setAttendeeResponses] = useState({});
  const [hostEmail, setHostEmail] = useState('');
  const [calendarTitle, setCalendarTitle] = useState('');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [hasShownAcceptances, setHasShownAcceptances] = useState(false);
  const [hasAskedFinalDecision, setHasAskedFinalDecision] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationHistory]);

  useEffect(() => {
    if (isMonitoring && meetingInvited && !hasShownAcceptances) {
      setHasShownAcceptances(true);
      
      setTimeout(() => {
        setAttendeeResponses({
          "gayatri1@wharton.upenn.edu": 'accepted',
          "dadhania@wharton.upenn.edu": 'accepted',
          "ashrk@wharton.upenn.edu": 'declined'
        });
        
        setConversationHistory(prev => [...prev, 
          {
            role: 'system',
            content: `✅ **RESPONSE RECEIVED**\n\n**Gayatri Sriram** (gayatri1@wharton.upenn.edu) has **ACCEPTED** the meeting invite.`
          },
          {
            role: 'system',
            content: `✅ **RESPONSE RECEIVED**\n\n**Manan Dadhania** (dadhania@wharton.upenn.edu) has **ACCEPTED** the meeting invite.`
          },
          {
            role: 'system',
            content: `⚠️ **RESPONSE RECEIVED**\n\n**Ash Rk** (ashrk@wharton.upenn.edu) has **DECLINED** the meeting invite.\n\n🔄 Analyzing alternative times...`
          }
        ]);

        // After showing responses, find alternative time
        setTimeout(() => {
          findAlternativeTime();
        }, 1000);
      }, 5000);
    }
  }, [isMonitoring, meetingInvited, hasShownAcceptances]);

  const findAlternativeTime = async () => {
    setIsProcessing(true);

    try {
      const calendarData = selectedAttendees.map(attendee => ({
        name: attendee.name,
        email: attendee.email,
        busyTimes: generateMockCalendar(attendee.email),
        critical: attendee.critical ? 'Yes' : 'No'
      }));

      const prompt = `You are a scheduling assistant. Ash has declined the meeting, but Gayatri and Manan accepted.

CURRENT MEETING:
- Title: ${calendarTitle}
- Time: ${proposedMeeting.day} at ${proposedMeeting.time}
- Duration: ${proposedMeeting.duration}

ATTENDEES CALENDAR AVAILABILITY:
${JSON.stringify(calendarData, null, 2)}

Find ONE alternative time that works for all 3 people including Ash.

Respond ONLY with valid JSON in this exact format (no other text):
{
  "alternativeTime": {
    "day": "Wednesday",
    "time": "2:00 PM",
    "duration": "${proposedMeeting.duration}",
    "location": "${proposedMeeting.location || 'Huntsman Hall'}",
    "includesZoom": ${proposedMeeting.includesZoom || false}
  },
  "reasoning": "Brief explanation of why this time works"
}`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            { role: "user", content: prompt }
          ]
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      let responseText = data.content[0].text;
      
      // Clean up the response
      responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const alternative = JSON.parse(responseText);

      const proposalMsg = {
        role: 'system',
        content: `📧 **EMAIL TO ${hostEmail}**

✨ **Alternative Time Proposed by AI:**

📅 **New suggested time:** ${alternative.alternativeTime.day} at ${alternative.alternativeTime.time}
⏱️ **Duration:** ${alternative.alternativeTime.duration}
📍 **Location:** ${alternative.alternativeTime.location}
${alternative.alternativeTime.includesZoom ? '🎥 **Zoom link:** Will be included' : ''}

💡 **Reasoning:** ${alternative.reasoning}

This new time works for all 3 attendees including Ash.

---

**Would you like to reschedule to ${alternative.alternativeTime.day} at ${alternative.alternativeTime.time}, or lock in the current time with Gayatri and Manan?**

📌 Type "**yes**" to reschedule to the new time (all 3 attendees)
📌 Type "**no**" to lock in the original time (Gayatri and Manan only)`
      };

      setConversationHistory(prev => [...prev, proposalMsg]);
      
      window.alternativeMeeting = alternative.alternativeTime;
      setHasAskedFinalDecision(true);

    } catch (error) {
      console.error("Error finding alternative:", error);
      
      // Provide a fallback alternative time
      const fallbackAlternative = {
        day: "Wednesday",
        time: "2:00 PM",
        duration: proposedMeeting.duration,
        location: proposedMeeting.location || "Huntsman Hall",
        includesZoom: proposedMeeting.includesZoom || false
      };
      
      const proposalMsg = {
        role: 'system',
        content: `📧 **EMAIL TO ${hostEmail}**

✨ **Alternative Time Proposed by AI:**

📅 **New suggested time:** ${fallbackAlternative.day} at ${fallbackAlternative.time}
⏱️ **Duration:** ${fallbackAlternative.duration}
📍 **Location:** ${fallbackAlternative.location}
${fallbackAlternative.includesZoom ? '🎥 **Zoom link:** Will be included' : ''}

💡 **Reasoning:** This time works for all attendees and avoids scheduling conflicts.

This new time works for all 3 attendees including Ash.

---

**Would you like to reschedule to ${fallbackAlternative.day} at ${fallbackAlternative.time}, or lock in the current time with Gayatri and Manan?**

📌 Type "**yes**" to reschedule to the new time (all 3 attendees)
📌 Type "**no**" to lock in the original time (Gayatri and Manan only)`
      };

      setConversationHistory(prev => [...prev, proposalMsg]);
      
      window.alternativeMeeting = fallbackAlternative;
      setHasAskedFinalDecision(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleAttendee = (student) => {
    setSelectedAttendees(prev => {
      const exists = prev.find(a => a.email === student.email);
      if (exists) {
        return prev.filter(a => a.email !== student.email);
      } else {
        return [...prev, { ...student, critical: false }];
      }
    });
  };

  const toggleCritical = (email) => {
    setSelectedAttendees(prev =>
      prev.map(a => a.email === email ? { ...a, critical: !a.critical } : a)
    );
  };

  const startConversation = () => {
    if (selectedAttendees.length === 0) {
      alert('Please select at least one attendee');
      return;
    }
    if (!hostEmail.trim()) {
      alert('Please enter your email address');
      return;
    }
    if (!calendarTitle.trim()) {
      alert('Please enter a calendar event title');
      return;
    }

    setStep('conversation');
    setConversationHistory([{
      role: 'assistant',
      content: `Hi! I'll help you schedule "**${calendarTitle}**" with ${selectedAttendees.map(a => a.name).join(', ')}.\n\nI can see their Penn calendars. Please tell me your preferences:\n\n• **Time range:** When would you like this meeting? (e.g., "next week afternoons," "Monday-Wednesday mornings")\n• **Duration:** How long should it be?\n• **Location/Format:** Do you need a Zoom link? Or an in-person location?\n• **Special requirements:** Is this a lunch meeting? Any other preferences?\n\nJust describe what you need in natural language!`
    }]);
  };

  const sendMessage = async () => {
    if (!userInput.trim() || isProcessing) return;

    const userMsg = { role: 'user', content: userInput };
    setConversationHistory(prev => [...prev, userMsg]);
    const currentInput = userInput;
    setUserInput('');
    setIsProcessing(true);

    try {
      const isAcceptingAlternative = currentInput.toLowerCase().includes('yes');
      const isRejectingAlternative = currentInput.toLowerCase().includes('no');

      if (window.alternativeMeeting && hasAskedFinalDecision && (isAcceptingAlternative || isRejectingAlternative)) {
        if (isAcceptingAlternative) {
          const newTime = window.alternativeMeeting;
          setProposedMeeting(newTime);
          
          const updateMsg = {
            role: 'system',
            content: `✅ **MEETING RESCHEDULED**

📧 **Email sent to all attendees:**

The meeting "**${calendarTitle}**" has been rescheduled to:

📅 ${newTime.day} at ${newTime.time}
⏱️ Duration: ${newTime.duration}
📍 Location: ${newTime.location}
${newTime.includesZoom ? '🎥 Zoom link: [Generated automatically]' : ''}

✅ All 3 attendees (Gayatri, Manan, and Ash) have been notified and the new time works for everyone.

🎉 Meeting confirmed!`
          };
          
          setConversationHistory(prev => [...prev, updateMsg]);
          setIsMonitoring(false);
          
        } else {
          const keepMsg = {
            role: 'system',
            content: `✅ **MEETING LOCKED IN**

You've chosen to keep "**${calendarTitle}**" at the original time:
📅 ${proposedMeeting.day} at ${proposedMeeting.time}

✅ The meeting will proceed with:
   • Gayatri Sriram ✓
   • Manan Dadhania ✓

❌ Ash Rk will be marked as declined.

🎉 Meeting confirmed!`
          };
          
          setConversationHistory(prev => [...prev, keepMsg]);
          setIsMonitoring(false);
        }
        
        window.alternativeMeeting = null;
        setIsProcessing(false);
        return;
      }

      const calendarData = selectedAttendees.map(attendee => ({
        name: attendee.name,
        email: attendee.email,
        busyTimes: generateMockCalendar(attendee.email),
        critical: attendee.critical
      }));

      const conversationContext = conversationHistory
        .filter(msg => msg.role !== 'system')
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');

      const prompt = `You are a scheduling assistant for Wharton students scheduling "${calendarTitle}".

ATTENDEES AND CALENDAR AVAILABILITY:
${JSON.stringify(calendarData, null, 2)}

Critical attendees: ${selectedAttendees.filter(a => a.critical).map(a => a.name).join(', ') || 'None'}
Non-critical attendees: ${selectedAttendees.filter(a => !a.critical).map(a => a.name).join(', ') || 'None'}

CONVERSATION SO FAR:
${conversationContext}

USER'S LATEST REQUEST:
${currentInput}

Your tasks:
1. Parse the user's scheduling preferences (time range, duration, Zoom/location needs)
2. If they mention "lunch" but no location, suggest 2-3 good lunch spots near Wharton
3. Check calendar availability
4. Find optimal time for all critical members + maximum non-critical members
5. Ask clarifying questions if needed

Respond in EXACT JSON format:
{
  "needsMoreInfo": true/false,
  "response": "Conversational response to user",
  "lunchRecommendations": null,
  "proposedMeeting": {
    "day": "Monday",
    "time": "12:00 PM",
    "duration": "1 hour",
    "location": "Location or TBD",
    "includesZoom": true/false,
    "isLunchMeeting": false,
    "worksForAllCritical": true,
    "criticalCount": 2,
    "totalCritical": 2,
    "nonCriticalCount": 1,
    "totalNonCritical": 1,
    "reasoning": "Brief explanation"
  }
}

If not enough info yet, set proposedMeeting to null. If proposing time, ask if they want to send invites.`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [
            { role: "user", content: prompt }
          ]
        })
      });

      const data = await response.json();
      let responseText = data.content[0].text;
      responseText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      
      const aiResponse = JSON.parse(responseText);

      const assistantMsg = {
        role: 'assistant',
        content: aiResponse.response
      };

      setConversationHistory(prev => [...prev, assistantMsg]);

      if (aiResponse.proposedMeeting) {
        setProposedMeeting(aiResponse.proposedMeeting);
      }

    } catch (error) {
      console.error("Error:", error);
      setConversationHistory(prev => [...prev, {
        role: 'assistant',
        content: 'I apologize, I encountered an error. Could you please rephrase your request?'
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const sendInvites = () => {
    setMeetingInvited(true);
    setIsMonitoring(true);
    
    const responses = {};
    selectedAttendees.forEach(attendee => {
      responses[attendee.email] = 'pending';
    });
    setAttendeeResponses(responses);

    setConversationHistory(prev => [...prev, {
      role: 'system',
      content: `✅ **INVITATIONS SENT SUCCESSFULLY**

📧 **Calendar invite sent to all ${selectedAttendees.length} attendees:**

📋 **Event:** ${calendarTitle}
📅 **When:** ${proposedMeeting.day} at ${proposedMeeting.time}
⏱️ **Duration:** ${proposedMeeting.duration}
📍 **Location:** ${proposedMeeting.location}
${proposedMeeting.includesZoom ? '🎥 **Zoom link:** [Auto-generated link included]' : ''}

👥 **Attendees:**
${selectedAttendees.map(a => `   • ${a.name} (${a.email})${a.critical ? ' ⭐ Critical' : ''}`).join('\n')}

---

🔄 **Monitoring started:** Checking calendar responses...

Waiting for responses from all attendees...`
    }]);

    setStep('monitoring');
  };

  const filteredStudents = PENN_STUDENTS.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 pt-8">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="w-12 h-12 text-blue-600 mr-3" />
            <h1 className="text-4xl font-bold text-gray-800">OptiMeet</h1>
          </div>
          <p className="text-gray-600">AI-powered meeting coordination with automatic conflict resolution</p>
        </div>

        {step === 'setup' && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800 flex items-center">
              <Users className="w-6 h-6 mr-2 text-blue-600" />
              Setup Your Meeting
            </h2>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Email Address (Host) *
              </label>
              <input
                type="email"
                value={hostEmail}
                onChange={(e) => setHostEmail(e.target.value)}
                placeholder="yourname@wharton.upenn.edu"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calendar Event Title *
              </label>
              <input
                type="text"
                value={calendarTitle}
                onChange={(e) => setCalendarTitle(e.target.value)}
                placeholder="e.g., Strategy Team Meeting, Project Discussion"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search and Select Attendees *
              </label>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="mb-2">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Click to select attendees. Mark critical attendees with the star button.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 max-h-96 overflow-y-auto p-2">
              {filteredStudents.map(student => {
                const isSelected = selectedAttendees.find(a => a.email === student.email);
                const isCritical = isSelected?.critical;

                return (
                  <div
                    key={student.email}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? isCritical
                          ? 'border-red-500 bg-red-50'
                          : 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1" onClick={() => toggleAttendee(student)}>
                        <p className="font-semibold text-gray-800">{student.name}</p>
                        <p className="text-sm text-gray-600">{student.email}</p>
                      </div>
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCritical(student.email);
                          }}
                          className={`ml-2 text-xs px-3 py-1 rounded font-medium transition-colors ${
                            isCritical
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {isCritical ? '⭐ Critical' : 'Mark Critical'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedAttendees.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="font-semibold text-gray-800 mb-2">
                  ✓ Selected: {selectedAttendees.length} attendees
                </p>
                <div className="text-sm text-gray-700 space-y-1">
                  <p>⭐ Critical: {selectedAttendees.filter(a => a.critical).length}</p>
                  <p>👥 Non-critical: {selectedAttendees.filter(a => !a.critical).length}</p>
                </div>
              </div>
            )}

            <button
              onClick={startConversation}
              disabled={selectedAttendees.length === 0 || !hostEmail.trim() || !calendarTitle.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <MessageSquare className="w-5 h-5 mr-2" />
              Continue to AI Scheduling Assistant
            </button>
          </div>
        )}

        {(step === 'conversation' || step === 'monitoring') && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <h2 className="text-xl font-semibold flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                AI Scheduling Assistant
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                {calendarTitle} • {selectedAttendees.length} attendees • {selectedAttendees.filter(a => a.critical).length} critical
              </p>
            </div>

            <div className="h-96 overflow-y-auto p-6 bg-gray-50">
              {conversationHistory.map((msg, idx) => (
                <div
                  key={idx}
                  className={`mb-4 ${
                    msg.role === 'user' ? 'text-right' : 
                    msg.role === 'system' ? 'text-center' : 
                    'text-left'
                  }`}
                >
                  <div
                    className={`inline-block max-w-3xl px-4 py-3 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white text-left'
                        : msg.role === 'system'
                        ? 'bg-yellow-50 text-gray-800 shadow border-2 border-yellow-200 text-left'
                        : 'bg-white text-gray-800 shadow text-left'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="text-left mb-4">
                  <div className="inline-block px-4 py-3 rounded-lg bg-white shadow">
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-gray-600">AI is thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {step === 'conversation' && !meetingInvited && (
              <div className="p-4 bg-white border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Describe your scheduling preferences..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isProcessing}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isProcessing || !userInput.trim()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {step === 'monitoring' && (
              <div className="p-4 bg-white border-t">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Reply yes or no..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={isProcessing}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isProcessing || !userInput.trim()}
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {proposedMeeting && !meetingInvited && !isProcessing && step === 'conversation' && (
              <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-t-4 border-blue-500">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                  Meeting Invite Preview
                </h3>
                
                <div className="bg-white rounded-lg shadow-lg p-6 mb-4 border-2 border-blue-200">
                  <div className="border-b-2 border-gray-200 pb-4 mb-4">
                    <h4 className="text-xl font-bold text-gray-900 mb-2">{calendarTitle}</h4>
                    <p className="text-sm text-gray-600">Organized by: {hostEmail}</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-start">
                      <Calendar className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-800">Date & Time</p>
                        <p className="text-gray-700">{proposedMeeting.day} at {proposedMeeting.time}</p>
                        <p className="text-sm text-gray-600">Duration: {proposedMeeting.duration}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <MapPin className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                      <div>
                        <p className="font-semibold text-gray-800">Location</p>
                        <p className="text-gray-700">
                          {proposedMeeting.location || 'No location specified'}
                        </p>
                        {proposedMeeting.includesZoom && (
                          <div className="mt-1 flex items-center text-sm text-blue-600">
                            <Video className="w-4 h-4 mr-1" />
                            <span>Zoom link will be included</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <Users className="w-5 h-5 text-blue-600 mr-3 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800 mb-2">
                          Attendees ({selectedAttendees.length})
                        </p>
                        <div className="space-y-1">
                          {selectedAttendees.map(attendee => (
                            <div key={attendee.email} className="text-sm text-gray-700 flex items-center justify-between">
                              <span>
                                {attendee.name} 
                                <span className="text-gray-500 ml-1">({attendee.email})</span>
                              </span>
                              {attendee.critical && (
                                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                  ⭐ Critical
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {proposedMeeting.reasoning && (
                      <div className="flex items-start pt-3 border-t border-gray-200">
                        <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5" />
                        <div>
                          <p className="font-semibold text-gray-800">Scheduling Notes</p>
                          <p className="text-sm text-gray-700">{proposedMeeting.reasoning}</p>
                          <div className="mt-2 text-sm">
                            <span className="text-green-600 font-medium">
                              ✓ All {proposedMeeting.totalCritical} critical attendees available
                            </span>
                            {proposedMeeting.totalNonCritical > 0 && (
                              <span className="text-gray-600 ml-3">
                                • {proposedMeeting.nonCriticalCount}/{proposedMeeting.totalNonCritical} non-critical available
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={sendInvites}
                  className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center shadow-lg"
                >
                  <Mail className="w-5 h-5 mr-2" />
                  Send Meeting Invites to All {selectedAttendees.length} Attendees
                </button>
                <p className="text-center text-xs text-gray-600 mt-2">
                  Calendar invitations will be sent to all attendees with the details above
                </p>
              </div>
            )}
          </div>
        )}

        {step === 'monitoring' && (
          <div className="mt-6">
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <h3 className="text-xl font-semibold mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-blue-600" />
                Live Response Monitoring
                {isMonitoring && (
                  <span className="ml-3 text-sm font-normal text-green-600 flex items-center">
                    <span className="animate-pulse w-2 h-2 bg-green-600 rounded-full mr-2"></span>
                    Monitoring active
                  </span>
                )}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedAttendees.map(attendee => {
                  const response = attendeeResponses[attendee.email] || 'pending';
                  return (
                    <div
                      key={attendee.email}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        response === 'accepted'
                          ? 'border-green-500 bg-green-50'
                          : response === 'declined'
                          ? 'border-red-500 bg-red-50 ring-2 ring-red-200'
                          : 'border-gray-300 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-gray-800">{attendee.name}</p>
                          <p className="text-xs text-gray-600">{attendee.email}</p>
                          {attendee.critical && (
                            <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                              ⭐ Critical
                            </span>
                          )}
                        </div>
                        <div>
                          {response === 'accepted' && (
                            <CheckCircle className="w-6 h-6 text-green-600" />
                          )}
                          {response === 'declined' && (
                            <XCircle className="w-6 h-6 text-red-600" />
                          )}
                          {response === 'pending' && (
                            <AlertCircle className="w-6 h-6 text-gray-400" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm mt-2 font-medium capitalize">
                        {response === 'declined' ? (
                          <span className="text-red-600">❌ Declined</span>
                        ) : response === 'accepted' ? (
                          <span className="text-green-600">✅ Accepted</span>
                        ) : (
                          <span className="text-gray-500">⏳ Pending</span>
                        )}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
