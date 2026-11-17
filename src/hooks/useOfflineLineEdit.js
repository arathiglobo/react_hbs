import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import axiosInstance from "../components/AxiosInstance";

/**
 * Edit mode for the Offline booking supplier forms (Hotel, Activity, Cab,
 * Visa). When the line table's edit button picks a line, the form gets it as
 * `editingEntry`; this hook loads that line's saved details from
 * GET /api/v1/offline-booking/line/{lineId} and fills the form through
 * `toForm(data)`. The answer is
 *   { lineId, supplierType, supplierName, mealPlanName, isoDates, line }
 * where `line` is the type's save payload (with its own id, e.g.
 * supplierHotelTypeId) and `isoDates` holds its dates as yyyy-MM-dd for the
 * date inputs. When `editingEntry` goes back to null the form is emptied.
 * If the line can't be loaded, a toast says so and `onCancelEdit` ends edit
 * mode, so the form never saves without the line's id.
 */
const useOfflineLineEdit = ({ editingEntry, initialForm, toForm, setForm, setErrors, onCancelEdit }) => {
  const [editData, setEditData] = useState(null);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setErrors({});
    setEditData(null);

    if (!editingEntry) {
      setIsLoadingEdit(false);
      setForm(initialForm);
      return undefined;
    }

    setIsLoadingEdit(true);
    axiosInstance
      .get(`/api/v1/offline-booking/line/${editingEntry.id}`)
      .then((res) => {
        if (cancelled) return;
        setEditData(res.data);
        setForm(toForm(res.data || {}));
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Error loading offline booking line:", error);
        toast.error(error.response?.data?.message || "Could not load this item for editing");
        if (onCancelEdit) onCancelEdit();
      })
      .finally(() => {
        if (!cancelled) setIsLoadingEdit(false);
      });

    return () => {
      cancelled = true;
    };
    // Re-run only when a different line is picked (or edit mode ends).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingEntry]);

  return {
    isEditing: Boolean(editingEntry),
    // The loaded line (null while loading) — its `line` holds the id to save under.
    editData,
    isLoadingEdit,
  };
};

/** Value for a text input from a number / string that may be null. */
export const asText = (value, fallback = "") =>
  value === null || value === undefined ? fallback : String(value);

/** The Supplier dropdown's value for a loaded line. */
export const supplierOptionFromLine = (data) => {
  const id = data?.line?.supplierId;
  if (id === null || id === undefined) return null;
  return { value: id, label: data.supplierName || String(id) };
};

export default useOfflineLineEdit;
