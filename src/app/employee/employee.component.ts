import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

interface Task {
  id: string;
  name: string;
  prLink?: string;
  description?: string;
  status?: string;
  hours?: string | number;
  extraHours?:string | number;
}
interface Employee {
  employeeId: string;
  employeeName: string;
  tasks: Task[];
}

interface Evaluation {
  employeeId: string;
  rating: number;
  remarks: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule, RouterModule],
  templateUrl: './employee.component.html',
  styleUrls: ['./employee.component.css']
})
export class EmployeeComponent implements OnInit {
  
  // Properties
  teamLeadId: string = ''; // This would come from login service
  teamLeadName: string = '';
  selectedDate: string = '';
  employees: Employee[] = [];
  selectedTask: Task | null = null;
  showTaskModal: boolean = false;
  ratings: { [key: string]: number } = {};
  remarks: { [key: string]: string } = {};
  dropdownOpen: { [key: string]: boolean } = {};
  employeeForm: any;

  alertMessage: string = '';
  showAlert: boolean = false;

  confirmMessage: string = '';
  showConfirm: boolean = false;
  confirmCallback: (() => void) | null = null;

  constructor(private http: HttpClient, private activatedRoute: ActivatedRoute, private router: Router) {}

  ngOnInit(): void {
   // ✅ Step 1: check for employeeId in URL → fallback to localStorage
    this.activatedRoute.queryParamMap.subscribe(params => {
      const empIdFromUrl = params.get('employeeId');
      const storedEmpId = localStorage.getItem('employeeId');

      if (empIdFromUrl) {
        this.teamLeadId = empIdFromUrl;
        localStorage.setItem('employeeId', empIdFromUrl);
        this.loadTeamLeadDetails(empIdFromUrl);
      } else if (storedEmpId) {
        this.teamLeadId = storedEmpId;
        this.loadTeamLeadDetails(storedEmpId);
      } else {
        console.warn('⚠️ No employeeId found in URL or localStorage!');
      }
    });
  }

  private loadTeamLeadDetails(employeeId: string): void {
    console.log('🔍 Loading team lead details for:', employeeId);
    
    this.http.get<any>(`https://emp-rating-backend.onrender.com/api/${employeeId}`)
      .subscribe({
        next: (res) => {
          console.log('✅ API Response:', res);
          
          if (res && res.employeeName) {
            this.teamLeadName = res.employeeName;
            console.log('Team Lead Name set to:', this.teamLeadName);
          } else {
            console.warn('⚠️ Response missing employeeName:', res);
            this.teamLeadName = 'Unknown TL';
            this.showCustomAlert(`Employee ID ${employeeId} not found or missing name`);
          }
        },
        error: (err) => {
          console.error('Error fetching team lead details:', err);
          console.error('Error status:', err.status);
          console.error('Error message:', err.message);
          console.error('Error details:', err.error);
          
          if (err.status === 404) {
            this.teamLeadName = 'Employee Not Found';
            this.showCustomAlert(`Employee with ID "${employeeId}" not found in database. Please check if the employee was registered correctly.`);
          } else if (err.status === 0) {
            this.teamLeadName = 'Connection Error';
            this.showCustomAlert('Cannot connect to backend server. Please check your internet connection.');
          } else {
            this.teamLeadName = 'Unknown TL';
            this.showCustomAlert(`Error loading employee details: ${err.message || 'Unknown error'}`);
          }
        }
      });
  }

  // Handle date save - fetch employees data
  onDateSave(): void {
    if (this.selectedDate && this.teamLeadId) {
    this.http.get<Employee[]>(`https://emp-rating-backend.onrender.com/api/v1/tasks/by-date?date=${this.selectedDate}&employeeId=${this.teamLeadId}`)
      .subscribe({
        next: (res) => {
          // Store only taskId + taskName initially
          this.employees = res.map(emp => ({
            ...emp,
            tasks: (emp.tasks as unknown as string[]).map((taskName, index) => ({
              id: `${emp.employeeId}-${index}`, // temporary/fake id
              name: taskName
            }))
          }));
        },
        error: (err) => {
          console.error('Error fetching employees', err);
          this.employees = [];
        }
      });
  }
}
  // Toggle dropdown for task selection
  toggleDropdown(employeeId: string): void {
    this.dropdownOpen[employeeId] = !this.dropdownOpen[employeeId];
    
    // Close other dropdowns
    Object.keys(this.dropdownOpen).forEach(key => {
      if (key !== employeeId) {
        this.dropdownOpen[key] = false;
      }
    });
  }


  // Handle task selection
onTaskSelect(employeeId: string, task: Task): void {
  // Show modal immediately
  this.selectedTask = { ...task, employeeId } as Task & { employeeId: string };
  this.showTaskModal = true;
  this.dropdownOpen[employeeId] = false;

  // ✅ Build API URL
  if (this.selectedDate && task.name) {
    const url = `https://emp-rating-backend.onrender.com/rating/getTasks?taskNames=${encodeURIComponent(task.name)}&employeeId=${employeeId}&workDate=${this.selectedDate}`;

    this.http.get<any>(url).subscribe({
      next: (res) => {
        // ✅ Map backend response into Task object
        this.selectedTask = {
          id: String(res.id),           // backend gives number → convert to string
          name: res.task,               // backend returns "task"
          description: res.description,
          prLink: res.prLink,
          status: res.status,
          hours: res.hours,
          extraHours: res.extraHours,
          employeeId
        } as Task & { employeeId: string };
      },
      error: (err) => {
        console.error('Error fetching task details:', err);
      }
    });
  } else {
    console.warn('⚠️ selectedDate or task.name missing!');
  }
}


  // Close task modal
  closeTaskModal(): void {
    this.showTaskModal = false;
    this.selectedTask = null;
  }

// Handle rating change
onRatingChange(employeeId: string, rating: any): void {
  this.ratings[employeeId] = Number(rating);
}

  // Handle remark change
  onRemarkChange(employeeId: string, event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.remarks[employeeId] = target.value;
    }
  }

// Get rating for employee
getRating(employeeId: string): number | '' {
  return this.ratings[employeeId] || '';
}

  // Get remark for employee
  getRemark(employeeId: string): string {
    return this.remarks[employeeId] || '';
  }


  // Get status class for styling
  getStatusClass(status: string): string {
    switch (status) {
      case 'Completed':
        return 'status-completed';
      case 'In Progress':
        return 'status-in-progress';
      case 'Pending':
        return 'status-pending';
      default:
        return '';
    }
  }

  // Reset form
  onReset(): void {
    this.selectedDate = '';
    this.employees = [];
    this.ratings = {};
    this.remarks = {};
    this.selectedTask = null;
    this.showTaskModal = false;
    this.dropdownOpen = {};
  }

  // Submit form
onSubmit(): void {
  const evaluations: Evaluation[] = this.employees.map(emp => ({
    employeeId: emp.employeeId,
    rating: this.ratings[emp.employeeId] || 0,
    remarks: this.remarks[emp.employeeId] || ''
  }));
 
  // Ensure date format is yyyy-MM-dd (Spring Boot friendly)
  const formattedDate = new Date(this.selectedDate).toISOString().split('T')[0];
 
  const submissionData = {
    teamLeadId: this.teamLeadId,
    date: formattedDate,
    evaluations: evaluations
  };
 
  const headers = new HttpHeaders({
    'Content-Type': 'application/json'
  });
 
  this.http.post('https://emp-rating-backend.onrender.com/rating/submit', submissionData, { headers })
    .subscribe({
      next: () => {
        this.showCustomAlert('Data submitted successfully!');
       this.onReset();
      },
      error: (err) => {
        console.error('Error submitting evaluations', err);
        this.showCustomAlert('Error while submitting data!');
      }
    });
}
  // Exit application
  onExit(): void {
    this.showCustomConfirm('Are you sure you want to exit?', () => {
      localStorage.clear();
      window.location.href = 'https://login-ivory-tau.vercel.app/';
    });
  }

  // Check if form is valid for submission
  isFormValid(): boolean {
    return this.selectedDate !== '' && this.employees.length > 0;
  }

   // --- Custom Alert Methods ---
  showCustomAlert(message: string): void {
    this.alertMessage = message;
    this.showAlert = true;
  }

  closeCustomAlert(): void {
    this.showAlert = false;
    this.alertMessage = '';
  }

  // --- Custom Confirm Methods ---
  showCustomConfirm(message: string, callback: () => void): void {
    this.confirmMessage = message;
    this.confirmCallback = callback;
    this.showConfirm = true;
  }

  confirmYes(): void {
    if (this.confirmCallback) this.confirmCallback();
    this.showConfirm = false;
  }

  confirmNo(): void {
    this.showConfirm = false;
    this.confirmMessage = '';
    this.confirmCallback = null;
  }
}

