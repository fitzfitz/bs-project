import { create } from 'zustand';

interface BookingState {
  branchId: string | null;
  selectedServiceIds: string[];
  selectedBarberId: string | null; // null represents "Any Available"
  selectedDate: Date | null;
  selectedTimeSlot: string | null; // format "HH:mm"
  
  setBranchInfo: (branchId: string) => void;
  toggleService: (serviceId: string) => void;
  setBarber: (barberId: string | null) => void;
  setDateTime: (date: Date, timeSlot: string) => void;
  resetBooking: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  branchId: null,
  selectedServiceIds: [],
  selectedBarberId: null,
  selectedDate: null,
  selectedTimeSlot: null,

  setBranchInfo: (branchId) => set({ branchId }),
  
  toggleService: (serviceId) => set((state) => {
    const isSelected = state.selectedServiceIds.includes(serviceId);
    if (isSelected) {
      return { selectedServiceIds: state.selectedServiceIds.filter(id => id !== serviceId) };
    } else {
      return { selectedServiceIds: [...state.selectedServiceIds, serviceId] };
    }
  }),
  
  setBarber: (barberId) => set({ selectedBarberId: barberId }),
  
  setDateTime: (date, timeSlot) => set({ selectedDate: date, selectedTimeSlot: timeSlot }),
  
  resetBooking: () => set({
    branchId: null,
    selectedServiceIds: [],
    selectedBarberId: null,
    selectedDate: null,
    selectedTimeSlot: null,
  }),
}));
