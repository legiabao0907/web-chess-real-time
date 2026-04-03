fetch('http://localhost:8080/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'testuser3', email: 'test3@example.com', password: 'password123' })
}).then(res => res.json()).then(console.log).catch(console.error);
