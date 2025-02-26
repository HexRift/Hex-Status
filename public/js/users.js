document.getElementById('editUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const userId = formData.get('userId');

    try {
        const response = await fetch(`/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(Object.fromEntries(formData))
        });
        if (response.ok) {
            location.reload();
        }
    } catch (error) {
        console.error('Failed to update user:', error);
    }
});

async function deleteUser(id) {
        try {
            const response = await fetch(`/users/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                location.reload();
            }
        } catch (error) {
            console.error('Failed to delete user:', error);
        }
    }
document.getElementById('menuToggle').addEventListener('click', function() {
    document.getElementById('mobileNav').classList.toggle('active');
    const icon = this.querySelector('i');
    icon.classList.toggle('fa-bars');
    icon.classList.toggle('fa-times');
});

function editUser(userId, username, email) {
    // Populate the edit modal with user data
    document.getElementById('editUserId').value = userId;
    document.getElementById('editUsername').value = username;
    document.getElementById('editEmail').value = email;
    
    // Show the modal
    document.getElementById('editModal').style.display = 'block';
}

function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}
  document.getElementById('addUserForm').addEventListener('submit', async (e) => {
      e.preventDefault();
    
      const formData = new FormData(e.target);
      const userData = {
          username: formData.get('username'),
          email: formData.get('email'),
          password: formData.get('password')
      };

      try {
          const response = await fetch('/users/add', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json'
              },
              body: JSON.stringify(userData)
          });

          const data = await response.json();

          if (data.success) {
              window.location.reload();
          } else {
              alert(data.message || 'Failed to add user');
          }
      } catch (error) {
          console.error('Error adding user:', error);
          alert('Failed to add user');
      }
  });