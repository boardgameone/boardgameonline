<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MarkPyraminxCellRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'face' => ['required', 'integer', 'between:0,3'],
            // Slots 0..5 are the 6 perimeter (up-triangle) cells: corners and edges.
            // Slots 6..8 are dead interior down-triangles — never markable.
            'slot' => ['required', 'integer', Rule::in([0, 1, 2, 3, 4, 5])],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'face.between' => 'Face must be between 0 and 3.',
            'slot.in' => 'Slot must be one of 0..5 (the 6 perimeter cells); the down-triangles are not playable.',
        ];
    }
}
