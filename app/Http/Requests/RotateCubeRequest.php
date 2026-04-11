<?php

namespace App\Http\Requests;

use App\Services\RubikCube;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RotateCubeRequest extends FormRequest
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
            'move' => ['required', 'string', Rule::in(RubikCube::MOVES)],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'move.in' => 'Invalid cube move. Must be one of: '.implode(', ', RubikCube::MOVES),
        ];
    }
}
