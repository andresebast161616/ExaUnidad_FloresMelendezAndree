// Simple authentication service with hardcoded credentials
const credentials = {
  username: "admin",
  password: "123456"
};

// Login function that returns a promise
export const login = (username, password) => {
  return new Promise((resolve, reject) => {
    // Simulate server delay
    setTimeout(() => {
      if (username === credentials.username && password === credentials.password) {
        // Create a session token (could be more sophisticated in a real app)
        const token = "mock-jwt-token-" + Math.random().toString(36).substr(2);
        // Store token in localStorage
        localStorage.setItem('authToken', token);
        localStorage.setItem('user', username);
        resolve({ success: true, user: username, token });
      } else {
        reject({ success: false, message: "Credenciales inválidas" });
      }
    }, 500); // 500ms delay to simulate network
  });
};

// Check if user is logged in
export const isAuthenticated = () => {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('user');
  return token && user;
};

// Logout function
export const logout = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('user');
  return { success: true };
};

export default {
  login,
  isAuthenticated,
  logout
};

