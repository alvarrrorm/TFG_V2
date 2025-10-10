import React from 'react';
import DatePicker from 'react-datepicker';
import { registerLocale } from 'react-datepicker';
import es from 'date-fns/locale/es'; // Importar el locale español
import 'react-datepicker/dist/react-datepicker.css';
import './CalendarioWeb.css'; // Importamos los estilos CSS

// Registrar el locale español
registerLocale('es', es);

export default function CalendarioWeb({ selectedDate, onChangeDate }) {
  const isValidDate = (dateString) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  };

  const getDayClassName = (date) => {
    if (!isValidDate(selectedDate)) return 'custom-day';
    
    const fechaSeleccionada = new Date(selectedDate);
    const mismoDia = 
      date.getDate() === fechaSeleccionada.getDate() &&
      date.getMonth() === fechaSeleccionada.getMonth() &&
      date.getFullYear() === fechaSeleccionada.getFullYear();
    
    return mismoDia ? 'custom-day-selected' : 'custom-day';
  };

  return (
    <div className="calendar-container">
      <DatePicker
        selected={isValidDate(selectedDate) ? new Date(selectedDate) : null}
        onChange={(date) => {
          if (date) {
            const fechaFormateada = date.toISOString().split('T')[0];
            onChangeDate(fechaFormateada);
          }
        }}
        minDate={new Date()}
        dateFormat="yyyy-MM-dd"
        placeholderText="Selecciona una fecha"
        className="custom-datepicker"
        locale="es" // Ahora sí funcionará porque está registrado
        calendarClassName="custom-calendar"
        dayClassName={getDayClassName}
        popperClassName="custom-popper"
        popperModifiers={[
          {
            name: 'offset',
            options: {
              offset: [0, 10],
            },
          },
          {
            name: 'preventOverflow',
            options: {
              rootBoundary: 'viewport',
              tether: false,
              altAxis: true,
            },
          },
        ]}
      />
    </div>
  );
}