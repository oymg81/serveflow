import { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = 'http://localhost:5001/api';
const TOKEN_KEY = 'serveflow_token';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [loading, setLoading] = useState(true);
  const [publicOrgs, setPublicOrgs] = useState([]); // for register dropdown
  
  // App Data
  const [organizations, setOrganizations] = useState([]);
  const [events, setEvents] = useState([]);
  const [ministries, setMinistries] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [users, setUsers] = useState([]);
  // Services & Bookings
  const [services, setServices] = useState([]);
  const [bookings, setBookings] = useState([]);

  const [error, setError] = useState(null);
  const [loginError, setLoginError] = useState(null);

  // Forms
  const [volEventId, setVolEventId] = useState('');
  const [volMinistryId, setVolMinistryId] = useState('');

  // Login Form
  const [loginEmailOrPhone, setLoginEmailOrPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register Form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regSlug, setRegSlug] = useState('');

  // Change Password Form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Create Organization Form
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [orgIndustry, setOrgIndustry] = useState('');
  const [orgStatus, setOrgStatus] = useState('Active');

  // Create OrgAdmin Form (keyed by org id)
  const [adminForms, setAdminForms] = useState({});
  // Track created admins per org: { [orgId]: [{ name, email, role }] }
  const [orgAdmins, setOrgAdmins] = useState({});
  // Inline success messages per org: { [orgId]: string }
  const [adminSuccess, setAdminSuccess] = useState({});

  // Create Service Form (OrgAdmin)
  const [svcTitle, setSvcTitle] = useState('');
  const [svcDesc, setSvcDesc] = useState('');
  const [svcDate, setSvcDate] = useState('');
  const [svcStart, setSvcStart] = useState('');
  const [svcEnd, setSvcEnd] = useState('');
  const [svcCapacity, setSvcCapacity] = useState('');

  // Edit Service state
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', service_date: '', start_time: '', end_time: '', capacity: '' });

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setCurrentUser(null);
      setLoading(false);
      // Still fetch public orgs so the register form dropdown works
      axios.get(`${API_URL}/auth/orgs`).then(r => setPublicOrgs(r.data)).catch(() => {});
      return;
    }

    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

    // Always load public orgs for the register dropdown
    axios.get(`${API_URL}/auth/orgs`).then(r => setPublicOrgs(r.data)).catch(() => {});

    axios.get(`${API_URL}/auth/me`)
      .then((res) => {
        setCurrentUser(res.data);
        if (!res.data.must_change_password) {
          fetchData(res.data.role);
        }
      })
      .catch((err) => {
        console.error("Auth failed:", err);
        localStorage.removeItem(TOKEN_KEY);
        delete axios.defaults.headers.common['Authorization'];
        setCurrentUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Fetch real admins for all orgs from the DB
  const fetchOrgAdmins = async (orgs) => {
    try {
      const adminsMap = {};
      await Promise.all(
        orgs
          .filter(o => o.slug !== 'system')
          .map(async (org) => {
            const res = await axios.get(`${API_URL}/organizations/${org.id}/admins`);
            adminsMap[org.id] = res.data;
          })
      );
      setOrgAdmins(adminsMap);
    } catch (err) {
      console.error('Failed to fetch org admins:', err);
    }
  };

  const fetchData = async (role) => {
    try {
      const [eRes, mRes, aRes] = await Promise.all([
        axios.get(`${API_URL}/events`),
        axios.get(`${API_URL}/ministries`),
        axios.get(`${API_URL}/assignments`),
      ]);
      setEvents(eRes.data);
      setMinistries(mRes.data);
      setAssignments(aRes.data);

      if (['OrgAdmin', 'SuperAdmin'].includes(role)) {
        const uRes = await axios.get(`${API_URL}/users`);
        setUsers(uRes.data);
      }
      
      if (role === 'SuperAdmin') {
        const oRes = await axios.get(`${API_URL}/organizations`);
        setOrganizations(oRes.data);
        // Fetch real admins from DB for each org
        await fetchOrgAdmins(oRes.data);
      }

      // Services & bookings — all authenticated users
      const [sRes, bRes] = await Promise.all([
        axios.get(`${API_URL}/services`),
        axios.get(`${API_URL}/bookings`),
      ]);
      setServices(sRes.data);
      setBookings(bRes.data);

      setError(null);
    } catch (err) {
      setError('Failed to fetch dashboard data: ' + err.message);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { emailOrPhone: loginEmailOrPhone, password: loginPassword });
      const { token: newToken, user } = res.data;
      localStorage.setItem(TOKEN_KEY, newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      setCurrentUser(user);
      if (!user.must_change_password) {
        fetchData(user.role);
      }
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Login failed');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await axios.post(`${API_URL}/auth/register`, {
        name: regName, email: regEmail, phone: regPhone, password: regPassword, slug: regSlug
      });
      alert(res.data.message || 'Registration successful! You can now log in.');
      setRegName(''); setRegEmail(''); setRegPhone(''); setRegPassword(''); setRegSlug('');
      setAuthMode('login');
    } catch (err) {
      setLoginError(err.response?.data?.error || 'Registration failed');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return alert('New passwords do not match!');
    }
    
    console.log("Token before change password:", localStorage.getItem(TOKEN_KEY));
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      handleLogout();
      return;
    }

    try {
      await axios.post(`${API_URL}/auth/change-password`, 
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Password updated successfully!');
      const updatedUser = { ...currentUser, must_change_password: false };
      setCurrentUser(updatedUser);
      fetchData(updatedUser.role);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update password');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.patch(`${API_URL}/assignments/${id}/status`, { status: newStatus });
      fetchData(currentUser.role);
    } catch (err) { alert('Failed to update status'); }
  };

  const handleUserStatusChange = async (id, userObj, newStatus) => {
    try {
      await axios.put(`${API_URL}/users/${id}`, { ...userObj, status: newStatus });
      fetchData(currentUser.role);
    } catch (err) { alert('Failed to update user status'); }
  };

  const handleVolunteerSignup = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/assignments`, {
        user_id: currentUser.id,
        event_id: volEventId,
        status: 'Pending'
      });
      alert('Signed up successfully!');
      fetchData(currentUser.role);
    } catch (err) { alert('Sign up failed: ' + err.message); }
  };

  // ── Services handlers ────────────────────────────────────────────────────
  const handleCreateService = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/services`, {
        title: svcTitle, description: svcDesc,
        service_date: svcDate, start_time: svcStart, end_time: svcEnd,
        capacity: svcCapacity || null
      });
      setSvcTitle(''); setSvcDesc(''); setSvcDate(''); setSvcStart(''); setSvcEnd(''); setSvcCapacity('');
      fetchData(currentUser.role);
    } catch (err) { alert(err.response?.data?.error || 'Failed to create service'); }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Delete this service? This cannot be undone.')) return;
    try {
      await axios.delete(`${API_URL}/services/${serviceId}`);
      setServices(prev => prev.filter(s => s.id !== serviceId));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete service');
    }
  };

  const startEditService = (svc) => {
    setEditingServiceId(svc.id);
    setEditForm({
      title: svc.title,
      description: svc.description || '',
      service_date: svc.service_date,
      start_time: svc.start_time,
      end_time: svc.end_time,
      capacity: svc.capacity ?? '',
    });
  };

  const handleUpdateService = async (e, serviceId) => {
    e.preventDefault();
    try {
      const res = await axios.put(`${API_URL}/services/${serviceId}`, {
        title: editForm.title,
        description: editForm.description,
        service_date: editForm.service_date,
        start_time: editForm.start_time,
        end_time: editForm.end_time,
        capacity: editForm.capacity || null,
      });
      setServices(prev => prev.map(s => s.id === serviceId ? res.data : s));
      setEditingServiceId(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update service');
    }
  };

  const handleBook = async (serviceId) => {
    try {
      await axios.post(`${API_URL}/bookings`, { service_id: serviceId });
      fetchData(currentUser.role);
    } catch (err) { alert(err.response?.data?.error || 'Booking failed'); }
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await axios.patch(`${API_URL}/bookings/${bookingId}/status`, { status: 'Cancelled' });
      fetchData(currentUser.role);
    } catch (err) { alert('Failed to cancel booking'); }
  };

  const handleBookingStatus = async (bookingId, status) => {
    try {
      await axios.patch(`${API_URL}/bookings/${bookingId}/status`, { status });
      fetchData(currentUser.role);
    } catch (err) { alert('Failed to update booking'); }
  };

  // Helper — returns the user's booking for a given service, or null
  const myBookingFor = (serviceId) =>
    bookings.find(b => b.service_id === serviceId && b.user_id === currentUser.id) || null;

  // Helper — returns spot counts for capacity display
  const spotsLeft = (svc) => {
    if (svc.capacity == null) return null;
    const taken = bookings.filter(b => b.service_id === svc.id && b.status !== 'Cancelled').length;
    return svc.capacity - taken;
  };

  const handleCreateOrganization = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/organizations`, {
        name: orgName, slug: orgSlug, industry: orgIndustry, status: orgStatus
      });
      setOrgName(''); setOrgSlug(''); setOrgIndustry(''); setOrgStatus('Active');
      fetchData(currentUser.role);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create organization');
    }
  };

  const handleCreateOrgAdmin = async (e, orgId) => {
    e.preventDefault();
    const form = adminForms[orgId];
    if (!form || !form.name || !form.email || !form.password) return alert('Missing required fields');
    
    try {
      const res = await axios.post(`${API_URL}/organizations/${orgId}/admins`, form);
      const newAdmin = res.data.user;

      // Re-fetch real admins from DB for this org
      const adminRes = await axios.get(`${API_URL}/organizations/${orgId}/admins`);
      setOrgAdmins(prev => ({ ...prev, [orgId]: adminRes.data }));

      // Show inline success message and clear form
      setAdminSuccess(prev => ({ ...prev, [orgId]: `✅ OrgAdmin "${newAdmin.name}" created! They must change their password on first login.` }));
      setAdminForms(prev => ({ ...prev, [orgId]: { name: '', email: '', phone: '', password: '' } }));

      // Clear success message after 5 seconds
      setTimeout(() => setAdminSuccess(prev => ({ ...prev, [orgId]: null })), 5000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to create OrgAdmin');
    }
  };

  const updateAdminForm = (orgId, field, value) => {
    setAdminForms({
      ...adminForms,
      [orgId]: {
        ...(adminForms[orgId] || { name: '', email: '', phone: '', password: '' }),
        [field]: value
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p className="text-gray-500 font-bold">Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-100">
          <h1 className="text-4xl font-extrabold text-blue-600 mb-6 text-center">ServeFlow</h1>
          
          {loginError && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{loginError}</div>}

          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 text-center">Log In</h2>
              <input required type="text" placeholder="Email or Phone" value={loginEmailOrPhone} onChange={e=>setLoginEmailOrPhone(e.target.value)} className="w-full border p-3 rounded" />
              
              <div className="relative">
                <input required type={showPassword ? "text" : "password"} placeholder="Password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} className="w-full border p-3 rounded" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-sm text-gray-500 hover:text-gray-700 font-bold">
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700">Login</button>
              <p className="text-center text-sm text-gray-500 mt-4">
                No account? <button type="button" onClick={() => setAuthMode('register')} className="text-blue-600 underline">Register</button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 text-center">Register</h2>
              <input required type="text" placeholder="Full Name" value={regName} onChange={e=>setRegName(e.target.value)} className="w-full border p-3 rounded" />
              <input required type="email" placeholder="Email" value={regEmail} onChange={e=>setRegEmail(e.target.value)} className="w-full border p-3 rounded" />
              <input type="text" placeholder="Phone (Optional)" value={regPhone} onChange={e=>setRegPhone(e.target.value)} className="w-full border p-3 rounded" />
              <input required type="password" placeholder="Password" value={regPassword} onChange={e=>setRegPassword(e.target.value)} className="w-full border p-3 rounded" />
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Organization</label>
                <select required value={regSlug} onChange={e=>setRegSlug(e.target.value)} className="w-full border p-3 rounded bg-white">
                  <option value="">-- Select your organization --</option>
                  {publicOrgs.map(org => (
                    <option key={org.id} value={org.slug}>{org.name}</option>
                  ))}
                </select>
                {publicOrgs.length === 0 && <p className="text-xs text-gray-400 mt-1">No organizations available. Contact your administrator.</p>}
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700">Sign Up</button>
              <p className="text-center text-sm text-gray-500 mt-4">
                Already have an account? <button type="button" onClick={() => setAuthMode('login')} className="text-blue-600 underline">Log In</button>
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Intercept for forced password change
  if (currentUser && currentUser.must_change_password) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md border border-gray-100">
          <h1 className="text-2xl font-extrabold text-gray-800 mb-2 text-center">Change Password Required</h1>
          <p className="text-gray-500 mb-6 text-center text-sm">For your security, please update your temporary password before accessing your dashboard.</p>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="relative">
              <input required type={showChangePassword ? "text" : "password"} placeholder="Current Password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} className="w-full border p-3 rounded" />
              <button type="button" onClick={() => setShowChangePassword(!showChangePassword)} className="absolute right-3 top-3 text-sm text-gray-500 hover:text-gray-700 font-bold">
                {showChangePassword ? "Hide" : "Show"}
              </button>
            </div>
            <div className="relative">
              <input required type={showChangePassword ? "text" : "password"} placeholder="New Password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="w-full border p-3 rounded" />
              <button type="button" onClick={() => setShowChangePassword(!showChangePassword)} className="absolute right-3 top-3 text-sm text-gray-500 hover:text-gray-700 font-bold">
                {showChangePassword ? "Hide" : "Show"}
              </button>
            </div>
            <div className="relative">
              <input required type={showChangePassword ? "text" : "password"} placeholder="Confirm New Password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} className="w-full border p-3 rounded" />
              <button type="button" onClick={() => setShowChangePassword(!showChangePassword)} className="absolute right-3 top-3 text-sm text-gray-500 hover:text-gray-700 font-bold">
                {showChangePassword ? "Hide" : "Show"}
              </button>
            </div>
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded hover:bg-blue-700">Update Password</button>
            <button type="button" onClick={handleLogout} className="w-full text-red-500 font-bold py-2 mt-2">Cancel & Logout</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-3xl font-extrabold text-blue-700">ServeFlow</h1>
            <p className="text-sm text-gray-500 mt-1">Production System</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-gray-800">Logged in as: {currentUser.name}</p>
            <p className="text-xs text-blue-600 uppercase font-semibold mb-2">{currentUser.role}</p>
            <button onClick={handleLogout} className="text-sm text-red-500 hover:underline font-bold">Logout</button>
          </div>
        </header>

        {error && <div className="bg-red-100 text-red-700 p-4 rounded-lg">{error}</div>}

        {/* SUPER ADMIN ONLY: ORGANIZATIONS VIEW */}
        {currentUser.role === 'SuperAdmin' && (
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Organizations Management</h2>
              
              <div className="bg-gray-50 p-4 rounded border border-gray-100 mb-6">
                <h3 className="font-bold text-sm mb-3">Create New Organization</h3>
                <form onSubmit={handleCreateOrganization} className="flex flex-wrap gap-3">
                  <input required placeholder="Name (e.g. Boundless Church)" value={orgName} onChange={e=>setOrgName(e.target.value)} className="border p-2 rounded flex-1 min-w-[200px]" />
                  <input required placeholder="Slug (e.g. boundless)" value={orgSlug} onChange={e=>setOrgSlug(e.target.value)} className="border p-2 rounded flex-1 min-w-[150px]" />
                  <input placeholder="Industry (e.g. church)" value={orgIndustry} onChange={e=>setOrgIndustry(e.target.value)} className="border p-2 rounded flex-1 min-w-[150px]" />
                  <select value={orgStatus} onChange={e=>setOrgStatus(e.target.value)} className="border p-2 rounded">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                  <button type="submit" className="bg-blue-600 text-white font-bold px-4 py-2 rounded hover:bg-blue-700 whitespace-nowrap">Create Org</button>
                </form>
              </div>

              <div className="space-y-4">
                {organizations.map(org => {
                  const isSystemOrg = org.slug === 'system';
                  const aForm = adminForms[org.id] || { name: '', email: '', phone: '', password: '' };
                  const createdAdmins = orgAdmins[org.id] || [];
                  const successMsg = adminSuccess[org.id];
                  return (
                    <div key={org.id} className="border p-4 rounded-xl shadow-sm bg-white">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-lg font-bold text-blue-700">{org.name} <span className="text-sm font-normal text-gray-500">({org.slug})</span></h3>
                          <p className="text-sm text-gray-600">Industry: {org.industry || 'N/A'} | Status: <span className={org.status === 'Active' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{org.status}</span></p>
                        </div>
                        {isSystemOrg && <span className="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-1 rounded">Platform Org</span>}
                      </div>

                      {/* List existing OrgAdmins for this org */}
                      {createdAdmins.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Admins</p>
                          <ul className="space-y-1">
                            {createdAdmins.map(admin => (
                              <li key={admin.id} className="flex items-center gap-2 text-sm bg-green-50 border border-green-100 rounded px-3 py-2">
                                <span className="font-bold text-gray-800">{admin.name}</span>
                                <span className="text-gray-500">{admin.email}</span>
                                <span className="ml-auto text-xs text-orange-600 font-semibold">Must change password</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {successMsg && (
                        <div className="bg-green-100 text-green-800 text-sm p-3 rounded mb-3 font-semibold">{successMsg}</div>
                      )}

                      {/* Hide admin creation form for system org */}
                      {isSystemOrg ? (
                        <div className="bg-gray-100 border border-gray-200 rounded p-3 text-sm text-gray-500 italic">
                          System Organization is reserved for the platform owner. OrgAdmins cannot be created here.
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-4 rounded border border-gray-200">
                          <h4 className="text-sm font-bold text-gray-800 mb-3">Add OrgAdmin</h4>
                          <form onSubmit={(e) => handleCreateOrgAdmin(e, org.id)} className="flex flex-wrap gap-2">
                            <input required placeholder="Admin Name" value={aForm.name} onChange={e=>updateAdminForm(org.id, 'name', e.target.value)} className="border p-2 rounded text-sm flex-1 min-w-[120px]" />
                            <input required type="email" placeholder="Email" value={aForm.email} onChange={e=>updateAdminForm(org.id, 'email', e.target.value)} className="border p-2 rounded text-sm flex-1 min-w-[120px]" />
                            <input placeholder="Phone" value={aForm.phone} onChange={e=>updateAdminForm(org.id, 'phone', e.target.value)} className="border p-2 rounded text-sm flex-1 min-w-[120px]" />
                            <input required type="text" placeholder="Temp Password" value={aForm.password} onChange={e=>updateAdminForm(org.id, 'password', e.target.value)} className="border p-2 rounded text-sm flex-1 min-w-[120px]" />
                            <button type="submit" className="bg-green-600 text-white font-bold px-3 py-2 rounded text-sm hover:bg-green-700 whitespace-nowrap">Add Admin</button>
                          </form>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ORG ADMIN & SUPER ADMIN VIEW */}
        {['OrgAdmin', 'SuperAdmin'].includes(currentUser.role) && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">User Directory & Approvals</h2>
                <ul className="max-h-64 overflow-y-auto space-y-2">
                  {users.map(u => (
                    <li key={u.id} className={`p-3 rounded border text-sm flex justify-between items-center ${u.status === 'Pending Approval' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100'}`}>
                      <div>
                        <p className="font-bold">{u.name}</p>
                        <p className="text-xs text-gray-500">{u.email} | {u.role}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {u.status === 'Pending Approval' ? (
                          <button onClick={() => handleUserStatusChange(u.id, u, 'Active')} className="bg-blue-600 text-white text-xs px-3 py-1 rounded font-bold">Approve</button>
                        ) : (
                          <span className="text-xs text-green-700 font-bold bg-green-100 px-2 py-1 rounded">Active</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Assignments Management</h2>
                <ul className="max-h-64 overflow-y-auto space-y-2">
                  {assignments.map(a => (
                    <li key={a.assignment_id} className="p-3 bg-gray-50 rounded border border-gray-100 text-sm flex justify-between items-center">
                      <div>
                        <p className="font-bold">{a.user_name} <span className="text-gray-400 font-normal">in</span> {a.ministry_title}</p>
                        <p className="text-xs text-gray-500">{a.event_name}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs font-bold ${a.status === 'Confirmed' ? 'text-green-600' : a.status === 'Declined' ? 'text-red-600' : 'text-yellow-600'}`}>{a.status}</span>
                        {a.status !== 'Confirmed' && <button onClick={() => handleStatusChange(a.assignment_id, 'Confirmed')} className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">✔</button>}
                        {a.status !== 'Declined' && <button onClick={() => handleStatusChange(a.assignment_id, 'Declined')} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">✕</button>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* MINISTRY LEADER VIEW */}
        {currentUser.role === 'MinistryLeader' && (
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Ministry Assignments</h2>
            <ul className="space-y-2">
              {assignments.length === 0 ? <p className="text-sm text-gray-500">No assignments to review.</p> : assignments.map(a => (
                <li key={a.assignment_id} className="p-4 bg-gray-50 rounded border border-gray-100 flex justify-between items-center">
                  <div>
                    <p className="font-bold">{a.user_name}</p>
                    <p className="text-sm text-gray-600">{a.event_name}</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-semibold">{a.status}</span>
                    {a.status !== 'Confirmed' && <button onClick={() => handleStatusChange(a.assignment_id, 'Confirmed')} className="text-xs bg-green-500 text-white px-3 py-1.5 rounded">Confirm</button>}
                    {a.status !== 'Declined' && <button onClick={() => handleStatusChange(a.assignment_id, 'Declined')} className="text-xs bg-red-500 text-white px-3 py-1.5 rounded">Decline</button>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* VOLUNTEER VIEW */}
        {currentUser.role === 'Volunteer' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Sign Up to Serve</h2>
              <form onSubmit={handleVolunteerSignup} className="space-y-4">
                <select required value={volEventId} onChange={e => setVolEventId(e.target.value)} className="w-full border p-3 rounded-lg bg-gray-50 outline-none">
                  <option value="">-- Choose Event --</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
                </select>
                <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700">Submit Availability</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">My Schedule</h2>
              <ul className="space-y-2">
                {assignments.length === 0 ? <p className="text-sm text-gray-500">You haven't signed up yet.</p> : assignments.map(a => (
                  <li key={a.assignment_id} className="p-4 bg-gray-50 rounded border border-gray-100 flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-800">{a.event_name}</p>
                      <p className="text-xs text-purple-600 font-bold uppercase">{a.ministry_title}</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="text-sm font-semibold text-gray-600">{a.status}</span>
                      {a.status !== 'Declined' && <button onClick={() => handleStatusChange(a.assignment_id, 'Declined')} className="text-xs text-red-500 hover:underline">Cancel</button>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {/* ── SERVICES: OrgAdmin create + booking management ─────────────── */}
        {['OrgAdmin', 'SuperAdmin'].includes(currentUser.role) && (
          <div className="space-y-6">

            {/* Create Service Form */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Services Management</h2>
              <div className="bg-gray-50 p-4 rounded border border-gray-100 mb-5">
                <h3 className="font-bold text-sm text-gray-700 mb-3">Create New Service</h3>
                <form onSubmit={handleCreateService} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input required placeholder="Title (e.g. Sunday Service, Massage, Dinner)" value={svcTitle} onChange={e=>setSvcTitle(e.target.value)} className="border p-2 rounded text-sm col-span-2" />
                  <textarea placeholder="Description (optional)" value={svcDesc} onChange={e=>setSvcDesc(e.target.value)} rows={2} className="border p-2 rounded text-sm col-span-2 resize-none" />
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500">Date</label>
                    <input required type="date" value={svcDate} onChange={e=>setSvcDate(e.target.value)} className="border p-2 rounded text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs font-semibold text-gray-500">Start</label>
                      <input required type="time" value={svcStart} onChange={e=>setSvcStart(e.target.value)} className="border p-2 rounded text-sm" />
                    </div>
                    <div className="flex flex-col gap-1 flex-1">
                      <label className="text-xs font-semibold text-gray-500">End</label>
                      <input required type="time" value={svcEnd} onChange={e=>setSvcEnd(e.target.value)} className="border p-2 rounded text-sm" />
                    </div>
                  </div>
                  <input type="number" min="1" placeholder="Capacity (leave blank = unlimited)" value={svcCapacity} onChange={e=>setSvcCapacity(e.target.value)} className="border p-2 rounded text-sm" />
                  <button type="submit" className="bg-blue-600 text-white font-bold px-4 py-2 rounded hover:bg-blue-700 text-sm">Create Service</button>
                </form>
              </div>

              {/* Services list with booking counts */}
              <div className="space-y-3">
                {services.length === 0 && <p className="text-sm text-gray-400 italic">No services yet. Create one above.</p>}
                {services.map(svc => {
                  const svcBookings = bookings.filter(b => b.service_id === svc.id);
                  const confirmed = svcBookings.filter(b => b.status === 'Confirmed').length;
                  const pending   = svcBookings.filter(b => b.status === 'Pending').length;
                  const spots = spotsLeft(svc);
                  const isEditing = editingServiceId === svc.id;
                  return (
                    <div key={svc.id} className="border rounded-xl p-4 bg-gray-50">
                      {/* ── Header row with Edit / Delete ── */}
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-gray-800">{svc.title}</p>
                          <p className="text-xs text-gray-500">{svc.service_date} · {svc.start_time} – {svc.end_time}</p>
                          {svc.description && <p className="text-xs text-gray-400 mt-1">{svc.description}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <div className="text-right text-xs space-y-1">
                            <span className="block text-green-700 font-bold">{confirmed} confirmed</span>
                            <span className="block text-yellow-600 font-bold">{pending} pending</span>
                            {spots !== null && <span className={`block font-bold ${spots <= 0 ? 'text-red-600' : 'text-blue-600'}`}>{spots <= 0 ? 'Full' : `${spots} spots left`}</span>}
                          </div>
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => isEditing ? setEditingServiceId(null) : startEditService(svc)}
                              className="text-xs font-bold px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200"
                            >
                              {isEditing ? 'Cancel' : '✏️ Edit'}
                            </button>
                            <button
                              onClick={() => handleDeleteService(svc.id)}
                              className="text-xs font-bold px-3 py-1 rounded bg-red-100 text-red-600 hover:bg-red-200 border border-red-200"
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* ── Inline Edit Form ── */}
                      {isEditing && (
                        <form
                          onSubmit={(e) => handleUpdateService(e, svc.id)}
                          className="mt-3 bg-white border border-blue-100 rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                          <input
                            required
                            placeholder="Title"
                            value={editForm.title}
                            onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                            className="border p-2 rounded text-sm col-span-2"
                          />
                          <textarea
                            placeholder="Description (optional)"
                            value={editForm.description}
                            onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                            rows={2}
                            className="border p-2 rounded text-sm col-span-2 resize-none"
                          />
                          <div className="flex flex-col gap-1">
                            <label className="text-xs font-semibold text-gray-500">Date</label>
                            <input
                              required
                              type="date"
                              value={editForm.service_date}
                              onChange={e => setEditForm(f => ({ ...f, service_date: e.target.value }))}
                              className="border p-2 rounded text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-xs font-semibold text-gray-500">Start</label>
                              <input
                                required
                                type="time"
                                value={editForm.start_time}
                                onChange={e => setEditForm(f => ({ ...f, start_time: e.target.value }))}
                                className="border p-2 rounded text-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                              <label className="text-xs font-semibold text-gray-500">End</label>
                              <input
                                required
                                type="time"
                                value={editForm.end_time}
                                onChange={e => setEditForm(f => ({ ...f, end_time: e.target.value }))}
                                className="border p-2 rounded text-sm"
                              />
                            </div>
                          </div>
                          <input
                            type="number"
                            min="1"
                            placeholder="Capacity (blank = unlimited)"
                            value={editForm.capacity}
                            onChange={e => setEditForm(f => ({ ...f, capacity: e.target.value }))}
                            className="border p-2 rounded text-sm"
                          />
                          <button
                            type="submit"
                            className="bg-blue-600 text-white font-bold px-4 py-2 rounded hover:bg-blue-700 text-sm"
                          >
                            Save Changes
                          </button>
                        </form>
                      )}

                      {/* Booking rows per service */}
                      {svcBookings.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {svcBookings.map(b => (
                            <li key={b.booking_id} className="flex items-center justify-between text-xs bg-white border rounded px-3 py-2">
                              <span className="font-semibold text-gray-700">{b.user_name}</span>
                              <span className="text-gray-400">{b.user_email}</span>
                              <span className={`font-bold ${b.status === 'Confirmed' ? 'text-green-600' : b.status === 'Cancelled' ? 'text-gray-400' : 'text-yellow-600'}`}>{b.status}</span>
                              <div className="flex gap-1">
                                {b.status !== 'Confirmed' && b.status !== 'Cancelled' && (
                                  <button onClick={() => handleBookingStatus(b.booking_id, 'Confirmed')} className="bg-green-500 text-white px-2 py-0.5 rounded text-xs hover:bg-green-600">Confirm</button>
                                )}
                                {b.status !== 'Cancelled' && (
                                  <button onClick={() => handleBookingStatus(b.booking_id, 'Cancelled')} className="bg-red-500 text-white px-2 py-0.5 rounded text-xs hover:bg-red-600">Reject</button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── SERVICES: User / Volunteer view ────────────────────────────── */}
        {['Volunteer', 'MinistryLeader'].includes(currentUser.role) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Available Services */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Available Services</h2>
              {services.length === 0 && <p className="text-sm text-gray-400 italic">No services available right now.</p>}
              <ul className="space-y-3">
                {services.map(svc => {
                  const myBk = myBookingFor(svc.id);
                  const spots = spotsLeft(svc);
                  const isFull = spots !== null && spots <= 0 && !myBk;
                  return (
                    <li key={svc.id} className="border rounded-xl p-4 bg-gray-50">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-gray-800">{svc.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{svc.service_date} · {svc.start_time} – {svc.end_time}</p>
                          {svc.description && <p className="text-xs text-gray-400 mt-1">{svc.description}</p>}
                          {spots !== null && (
                            <p className={`text-xs font-semibold mt-1 ${spots <= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                              {spots <= 0 ? 'Fully booked' : `${spots} spot${spots !== 1 ? 's' : ''} left`}
                            </p>
                          )}
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          {myBk ? (
                            <span className={`text-xs font-bold px-2 py-1 rounded ${myBk.status === 'Confirmed' ? 'bg-green-100 text-green-700' : myBk.status === 'Cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}`}>
                              {myBk.status}
                            </span>
                          ) : (
                            <button
                              disabled={isFull}
                              onClick={() => handleBook(svc.id)}
                              className={`text-sm font-bold px-3 py-1.5 rounded ${isFull ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                            >
                              {isFull ? 'Full' : 'Book'}
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* My Bookings */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">My Bookings</h2>
              {bookings.length === 0 && <p className="text-sm text-gray-400 italic">You have no bookings yet.</p>}
              <ul className="space-y-3">
                {bookings.map(b => (
                  <li key={b.booking_id} className="border rounded-xl p-4 bg-gray-50 flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800">{b.service_title}</p>
                      <p className="text-xs text-gray-500">{b.service_date} · {b.start_time} – {b.end_time}</p>
                      <span className={`mt-1 inline-block text-xs font-bold px-2 py-0.5 rounded ${b.status === 'Confirmed' ? 'bg-green-100 text-green-700' : b.status === 'Cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}`}>
                        {b.status}
                      </span>
                    </div>
                    {b.status !== 'Cancelled' && (
                      <button onClick={() => handleCancelBooking(b.booking_id)} className="text-xs text-red-500 hover:underline font-semibold ml-4 flex-shrink-0">Cancel</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
