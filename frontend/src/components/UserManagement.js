import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Box,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Person as PersonIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import axios from 'axios';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteDialog, setDeleteDialog] = useState({ open: false, user: null });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/users/', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
      setError(error.response?.data?.error || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    setDeleteDialog({ open: true, user });
  };

  const confirmDelete = async () => {
    try {
      const token = localStorage.getItem('token');
              await axios.delete(`/api/admin/users/${deleteDialog.user.id}/`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setSuccess(`User ${deleteDialog.user.username} deleted successfully`);
      setDeleteDialog({ open: false, user: null });
      fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error deleting user:', error);
      setError(error.response?.data?.error || 'Failed to delete user');
      setDeleteDialog({ open: false, user: null });
    }
  };

  const cancelDelete = () => {
    setDeleteDialog({ open: false, user: null });
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography variant="h6" align="center">
          Loading users...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        User Management
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            <PersonIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Registered Users ({users.length})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage user accounts. Demo users (Alice, Bob, Charlie) are protected and cannot be deleted.
          </Typography>
        </Box>

        {users.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary">
              No users found
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell>Joined</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="subtitle2">
                          {user.first_name} {user.last_name}
                          {user.is_admin && (
                            <Chip
                              label="Admin"
                              size="small"
                              color="primary"
                              sx={{ ml: 1 }}
                            />
                          )}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          @{user.username}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                          <EmailIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {user.email}
                          </Typography>
                        </Box>
                        {user.phone && (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <PhoneIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                            <Typography variant="body2">
                              {user.phone}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {user.address ? (
                        <Box>
                          <Typography variant="body2">
                            {user.address}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {user.city}, {user.state} {user.zip_code}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {user.country}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No address
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(user.date_joined)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={user.is_active ? 'Active' : 'Inactive'}
                        color={user.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      {!user.is_admin && (
                        <Tooltip title="Delete User">
                          <IconButton
                            color="error"
                            onClick={() => handleDeleteUser(user)}
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={cancelDelete}>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WarningIcon sx={{ color: 'error.main', mr: 1 }} />
            Confirm Delete
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete user <strong>{deleteDialog.user?.username}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This action cannot be undone. All user data including profile, orders, and cart will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelDelete}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete User
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default UserManagement;
