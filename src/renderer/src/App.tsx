import { useEffect, useState } from "react";
import type { Step, Trip } from "../../shared/types";

const blankTrip: Trip = {
  id: "",
  title: "",
  subtitle: "",
  startDate: "",
  endDate: "",
  coverPhotoId: "",
  createdAt: "",
  steps: [],
};
const dateRange = (startDate: string, endDate: string) =>
  [startDate, endDate]
    .filter(Boolean)
    .map((date) =>
      new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(`${date}T00:00:00`)),
    )
    .join(" - ");

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [trip, setTrip] = useState<Trip>(blankTrip);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"pdf" | "html" | "zip" | null>(null);
  const [version, setVersion] = useState("");
  const [platform, setPlatform] = useState("");

  const refresh = async (preferredId?: string) => {
    const all = await window.icySteps.listTrips();
    setTrips(all);
    const next =
      all.find((item) => item.id === (preferredId ?? trip.id)) ??
      all[0] ??
      blankTrip;
    setTrip(next);
    setSelectedStep((current) =>
      next.steps.some((step) => step.id === current)
        ? current
        : (next.steps[0]?.id ?? null),
    );
  };
  useEffect(() => {
    void refresh();
    void window.icySteps.appVersion().then(setVersion);
    void window.icySteps.appPlatform().then(setPlatform);
  }, []);

  const updateTrip = (patch: Partial<Trip>) =>
    setTrip((current) => ({ ...current, ...patch }));
  const persistTrip = async () => {
    if (trip.id) {
      await window.icySteps.saveTrip(trip);
      await refresh(trip.id);
    }
  };
  const deleteTrip = async () => {
    if (await window.icySteps.deleteTrip(trip.id)) await refresh();
  };
  const addTrip = async () => {
    const created = await window.icySteps.createTrip("Untitled journey");
    await refresh(created.id);
  };
  const addStep = async () => {
    if (!trip.id) return;
    const step = await window.icySteps.createStep(trip.id);
    await refresh(trip.id);
    setSelectedStep(step.id);
  };
  const updateStep = (patch: Partial<Step>) =>
    setTrip((current) => ({
      ...current,
      steps: current.steps.map((step) =>
        step.id === selectedStep ? { ...step, ...patch } : step,
      ),
    }));
  const updatePhotoCaption = (photoId: string, caption: string) =>
    updateStep({
      photos:
        currentStep?.photos.map((photo) =>
          photo.id === photoId ? { ...photo, caption } : photo,
        ) ?? [],
    });
  const currentStep = trip.steps.find((step) => step.id === selectedStep);
  const tripPhotos = trip.steps.flatMap((step) =>
    step.photos.map((photo) => ({ ...photo, stepTitle: step.title })),
  );
  const coverPhoto = tripPhotos.find((photo) => photo.id === trip.coverPhotoId);
  const persistStep = async () => {
    if (currentStep) {
      await window.icySteps.saveStep(currentStep);
      await refresh(trip.id);
    }
  };
  const importPhotos = async () => {
    if (!currentStep) return;
    const photos = await window.icySteps.importPhotos(currentStep.id);
    if (photos.length) {
      updateStep({ photos: [...currentStep.photos, ...photos] });
      await refresh(trip.id);
    }
  };
  const deletePhoto = async (photoId: string) => {
    if (confirm("Remove this photo from the chapter?")) {
      await window.icySteps.deletePhoto(photoId);
      await refresh(trip.id);
    }
  };
  const removeStep = async () => {
    if (
      currentStep &&
      confirm(`Delete “${currentStep.title || "this step"}”?`)
    ) {
      await window.icySteps.deleteStep(currentStep.id);
      await refresh(trip.id);
    }
  };
  const exportBook = async (kind: "pdf" | "html" | "zip") => {
    setExporting(kind);
    try {
      if (kind === "pdf") await window.icySteps.exportPdf(trip);
      else if (kind === "html") await window.icySteps.exportHtml(trip);
      else await window.icySteps.exportZip(trip);
    } finally {
      setExporting(null);
    }
  };

  if (!trip.id)
    return (
      <main className={platform === "linux" ? "empty linux" : "empty"}>
        <div className="mark">icySteps</div>
        <h1>
          Turn a journey into
          <br />a book you can keep.
        </h1>
        <p>
          Build each moment yourself. Your words, your photographs, entirely on
          this computer.
        </p>
        <button className="primary" onClick={addTrip}>
          Start a new journey
        </button>
      </main>
    );

  return (
    <div className={platform === "linux" ? "shell linux" : "shell"}>
      <aside className="sidebar">
        <div className="brand">
          icySteps{version && <span className="app-version">v{version}</span>}
        </div>
        <div className="export-actions">
          <button onClick={() => void exportBook("html")} disabled={exporting !== null}>
            {exporting === "html" ? "Preparing..." : "Export HTML"}
          </button>
          <button
            className="primary"
            onClick={() => void exportBook("pdf")}
            disabled={exporting !== null}
          >
            {exporting === "pdf" ? "Preparing..." : "Export PDF"}
          </button>
          <button onClick={() => void exportBook("zip")} disabled={exporting !== null}>
            {exporting === "zip" ? "Preparing..." : "Export ZIP"}
          </button>
        </div>
        <label className="eyebrow">Your journeys</label>
        <select
          value={trip.id}
          onChange={(event) => void refresh(event.target.value)}
        >
          {trips.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
        <button className="text-button" onClick={addTrip}>
          + New journey
        </button>
        <div className="rule" />
        <div className="step-title">
          <span className="eyebrow">Chapters</span>
          <button className="round" onClick={addStep} aria-label="Add step">
            +
          </button>
        </div>
        <nav>
          {trip.steps.map((step, index) => (
            <button
              key={step.id}
              className={
                selectedStep === step.id ? "step-link active" : "step-link"
              }
              onClick={() => setSelectedStep(step.id)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {step.title || "Untitled moment"}
            </button>
          ))}
        </nav>
      </aside>
      <main className="workspace">
        <section className="trip-fields panel">
          <div className="editor-head">
            <span className="eyebrow">Book details</span>
            <button className="danger" onClick={() => void deleteTrip()}>
              Delete journey
            </button>
          </div>
          <input
            className="trip-name"
            value={trip.title}
            onChange={(e) => updateTrip({ title: e.target.value })}
            onBlur={() => void persistTrip()}
            placeholder="Journey title"
          />
          <input
            value={trip.subtitle}
            onChange={(e) => updateTrip({ subtitle: e.target.value })}
            onBlur={() => void persistTrip()}
            placeholder="A small line for the cover"
          />
          <div className="dates">
            <input
              type="date"
              value={trip.startDate}
              onChange={(e) => updateTrip({ startDate: e.target.value })}
              onBlur={() => void persistTrip()}
            />
            <span>to</span>
            <input
              type="date"
              value={trip.endDate}
              onChange={(e) => updateTrip({ endDate: e.target.value })}
              onBlur={() => void persistTrip()}
            />
          </div>
          <label className="cover-photo-picker">
            <span className="eyebrow">Cover photo</span>
            <select
              value={trip.coverPhotoId}
              onChange={(event) => updateTrip({ coverPhotoId: event.target.value })}
              onBlur={() => void persistTrip()}
            >
              <option value="">Use the default cover</option>
              {tripPhotos.map((photo, index) => (
                <option key={photo.id} value={photo.id}>
                  {photo.stepTitle || "Untitled moment"} - Photo {index + 1}
                </option>
              ))}
            </select>
          </label>
        </section>
        {currentStep ? (
          <section className="editor panel">
            <div className="editor-head">
              <span className="eyebrow">
                Chapter {String(currentStep.sortOrder + 1).padStart(2, "0")}
              </span>
              <button className="danger" onClick={() => void removeStep()}>
                Delete
              </button>
            </div>
            <input
              className="step-name"
              value={currentStep.title}
              onChange={(e) => updateStep({ title: e.target.value })}
              onBlur={() => void persistStep()}
              placeholder="Give this moment a title"
            />
            <div className="metadata">
              <input
                type="date"
                value={currentStep.occurredAt}
                onChange={(e) => updateStep({ occurredAt: e.target.value })}
                onBlur={() => void persistStep()}
              />
              <input
                value={currentStep.placeName}
                onChange={(e) => updateStep({ placeName: e.target.value })}
                onBlur={() => void persistStep()}
                placeholder="Where were you?"
              />
            </div>
            <textarea
              value={currentStep.body}
              onChange={(e) => updateStep({ body: e.target.value })}
              onBlur={() => void persistStep()}
              placeholder="What happened? Write it the way you want to remember it."
            />
            <div className="photo-header">
              <span className="eyebrow">Photographs</span>
              <button
                className="text-button"
                onClick={() => void importPhotos()}
              >
                + Add photos
              </button>
            </div>
            {currentStep.photos.length ? (
              <div className="photo-grid">
                {currentStep.photos.map((photo) => (
                  <figure key={photo.id}>
                    <div className="photo-image">
                      <img
                        src={photo.path}
                        alt={photo.caption || currentStep.title}
                      />
                      <button
                        className="photo-delete"
                        onClick={() => void deletePhoto(photo.id)}
                        aria-label="Remove photo"
                      >
                        Remove
                      </button>
                    </div>
                    <input
                      value={photo.caption}
                      placeholder="Optional caption"
                      onChange={(event) =>
                        updatePhotoCaption(photo.id, event.target.value)
                      }
                      onBlur={(event) =>
                        void window.icySteps.savePhotoCaption(
                          photo.id,
                          event.currentTarget.value,
                        )
                      }
                    />
                  </figure>
                ))}
              </div>
            ) : (
              <button
                className="photo-drop"
                onClick={() => void importPhotos()}
              >
                Add photographs from your computer
              </button>
            )}
          </section>
        ) : (
          <section className="no-step panel">
            <h2>Your book is waiting for its first moment.</h2>
            <button className="primary" onClick={addStep}>
              Add a chapter
            </button>
          </section>
        )}
      </main>
      <aside className="preview">
        <div className="preview-label">LIVE BOOK PREVIEW</div>
        <div className="book">
          <div className={coverPhoto ? "book-cover has-photo" : "book-cover"}>
            {coverPhoto && <img className="preview-cover-image" src={coverPhoto.path} alt="" />}
            <div className="preview-cover-content">
              <small>icySteps presents</small>
              <h2>{trip.title}</h2>
              <p>{trip.subtitle || "A travel book"}</p>
              {(trip.startDate || trip.endDate) && (
                <span className="preview-dates">
                  {dateRange(trip.startDate, trip.endDate)}
                </span>
              )}
            </div>
          </div>
          {currentStep && (
            <div className="preview-page">
              <small>
                {currentStep.occurredAt || "A moment"}
                {currentStep.placeName ? ` / ${currentStep.placeName}` : ""}
              </small>
              <h3>{currentStep.title || "Untitled moment"}</h3>
              <p>{currentStep.body || "Your story will appear here."}</p>
              {currentStep.photos.length > 0 && (
                <div
                  className={
                    currentStep.photos.length === 1
                      ? "preview-photos single"
                      : "preview-photos"
                  }
                >
                  {currentStep.photos.map((photo) => (
                    <figure key={photo.id}>
                      <img
                        src={photo.path}
                        alt={photo.caption || currentStep.title}
                      />
                      {photo.caption && (
                        <figcaption>{photo.caption}</figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
