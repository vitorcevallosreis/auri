-- Tabela de Profissionais
CREATE TABLE IF NOT EXISTS myia_professionals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES myia_companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  specialty VARCHAR(255),
  registration_number VARCHAR(100),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Serviços
CREATE TABLE IF NOT EXISTS myia_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES myia_companies(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration INTEGER NOT NULL, -- duração em minutos
  price DECIMAL(10, 2),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Disponibilidade dos Profissionais
CREATE TABLE IF NOT EXISTS myia_professional_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES myia_professionals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES myia_services(id) ON DELETE CASCADE,
  weekday INTEGER NOT NULL, -- 1 = Segunda, 2 = Terça, etc.
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_simultaneous_clients INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (professional_id, service_id, weekday)
);

-- Tabela de Agendamentos
CREATE TABLE IF NOT EXISTS myia_appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES myia_companies(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES myia_professionals(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES myia_services(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES myia_contacts(id) ON DELETE CASCADE,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, completed, cancelled, no-show
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhorar a performance das consultas
CREATE INDEX IF NOT EXISTS idx_professionals_company ON myia_professionals(company_id);
CREATE INDEX IF NOT EXISTS idx_services_company ON myia_services(company_id);
CREATE INDEX IF NOT EXISTS idx_availability_professional ON myia_professional_availability(professional_id);
CREATE INDEX IF NOT EXISTS idx_availability_service ON myia_professional_availability(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_company ON myia_appointments(company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_professional ON myia_appointments(professional_id);
CREATE INDEX IF NOT EXISTS idx_appointments_service ON myia_appointments(service_id);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON myia_appointments(client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON myia_appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON myia_appointments(status);

-- Função para verificar disponibilidade de um profissional em uma data específica
CREATE OR REPLACE FUNCTION check_professional_availability(
  p_professional_id UUID,
  p_date DATE
) RETURNS TABLE (
  service_id UUID,
  service_name VARCHAR(255),
  start_time TIME,
  end_time TIME,
  max_simultaneous_clients INTEGER,
  current_bookings INTEGER,
  available_slots INTEGER
) AS $$
DECLARE
  weekday_num INTEGER;
BEGIN
  -- Determinar o dia da semana da data fornecida (1 = Segunda, 2 = Terça, etc.)
  weekday_num := EXTRACT(DOW FROM p_date);
  IF weekday_num = 0 THEN weekday_num := 7; END IF; -- Converter domingo de 0 para 7
  
  RETURN QUERY
  WITH booked_slots AS (
    SELECT 
      a.service_id,
      a.start_time,
      COUNT(*) as booking_count
    FROM 
      myia_appointments a
    WHERE 
      a.professional_id = p_professional_id
      AND a.appointment_date = p_date
      AND a.status = 'scheduled'
    GROUP BY 
      a.service_id, a.start_time
  )
  SELECT 
    pa.service_id,
    s.name as service_name,
    pa.start_time,
    pa.end_time,
    pa.max_simultaneous_clients,
    COALESCE(bs.booking_count, 0) as current_bookings,
    pa.max_simultaneous_clients - COALESCE(bs.booking_count, 0) as available_slots
  FROM 
    myia_professional_availability pa
  JOIN 
    myia_services s ON pa.service_id = s.id
  LEFT JOIN 
    booked_slots bs ON pa.service_id = bs.service_id 
      AND bs.start_time >= pa.start_time 
      AND bs.start_time < pa.end_time
  WHERE 
    pa.professional_id = p_professional_id
    AND pa.weekday = weekday_num
  ORDER BY 
    pa.start_time;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar disponibilidade de um profissional em um horário específico
CREATE OR REPLACE FUNCTION check_specific_time_availability(
  p_professional_id UUID,
  p_service_id UUID,
  p_date DATE,
  p_time TIME
) RETURNS TABLE (
  available BOOLEAN,
  available_slots INTEGER
) AS $$
DECLARE
  weekday_num INTEGER;
  v_available BOOLEAN;
  v_available_slots INTEGER;
BEGIN
  -- Determinar o dia da semana da data fornecida (1 = Segunda, 2 = Terça, etc.)
  weekday_num := EXTRACT(DOW FROM p_date);
  IF weekday_num = 0 THEN weekday_num := 7; END IF; -- Converter domingo de 0 para 7
  
  -- Verificar se o profissional tem disponibilidade para o serviço neste dia e horário
  SELECT 
    (pa.start_time <= p_time AND pa.end_time > p_time) as is_available,
    pa.max_simultaneous_clients - COALESCE(
      (SELECT COUNT(*) 
       FROM myia_appointments a 
       WHERE a.professional_id = p_professional_id 
         AND a.service_id = p_service_id 
         AND a.appointment_date = p_date 
         AND a.start_time = p_time
         AND a.status = 'scheduled'), 0) as slots
  INTO 
    v_available, v_available_slots
  FROM 
    myia_professional_availability pa
  WHERE 
    pa.professional_id = p_professional_id
    AND pa.service_id = p_service_id
    AND pa.weekday = weekday_num
  LIMIT 1;
  
  RETURN QUERY SELECT 
    COALESCE(v_available, false) as available,
    COALESCE(v_available_slots, 0) as available_slots;
END;
$$ LANGUAGE plpgsql;
